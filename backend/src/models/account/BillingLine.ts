import { BillingRepo } from "@src/repo/app/accounts/billing.repo";
import { Helper } from "@src/utilts/helper";
import { Serials } from "../product/Serials";
import { Batches } from "../product/Batches";
import { TaxModel } from "./InvoiceLine";
import { calculateLine, LineItem } from './calculations';

export class BillingLine {
    id = "";
    note = "";
    barcode = "";



    qty = 0;
    unitCost = 0;
    total = 0;
    subTotal = 0;
    taxTotal = 0;
    index = 0;

    billingId = "";
    productId: string | null; // if productId is not null and bill is not draft the bill will affect on line's account journal 
    accountId = ""; // affected account can only be of parentType ['Expense','Current Assets','Other Current Assets','Fixed Assets','Costs of Goods Sold','Operating Expense']
    employeeId = "";

    taxId: string | null;
    taxes: TaxModel[] = []  // empty when selected tax  is not Group tax 
    taxType: string = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;

    serials: any[] = [];
    batches: any[] = [];
    isInclusiveTax = false;


    baseAmount = 0
    discountTotal = 0
    discountAmount = 0;
    billDiscount = 0;
    applyDiscountBeforeTax = true;
    discountPercentage: boolean = true;

    selectedItem: any = {};


    serial = "";
    batch = "";
    prodDate = new Date();
    expireDate = new Date();
    isDeleted = false;
    //TODO: ADD TO DBS
    parentId: string | null; // For serials and batches

    UOM = "";
    productType = "";
    mediaUrl = ""


    maxQty = 0 //for supplier credit

    accountName = ""
    createdAt = new Date();
    SIC = ""; /**Supplier Item Code*/
    isReturned = false;

    productName = "";
    branchId = "";
    companyId = "";

    billingQty = 0;
    discountIncludesTax = false
    taxableAmount = 0;
    constructor() {
        this.productId = null;
        this.taxId = null;
        this.parentId = null;
    }


    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "taxes" && json[key] && JSON.stringify(json[key]) != '{}') {
                const taxesTemp: TaxModel[] = [];
                let taxTemp: TaxModel;
                json[key].forEach((line: any) => {
                    taxTemp = new TaxModel();
                    taxTemp.ParseJson(line);
                    taxesTemp.push(taxTemp);
                });
                this.taxes = taxesTemp;
            } else {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    calculateTaxPercentage() {
        let total = 0;
        this.taxes.forEach((element: any) => {
            total += element.taxPercentage
        });
        this.taxPercentage = total;
    }

    getBasePrice(total: number, taxes: TaxModel[], afterDecimal: number) {


        let taxesAmount = this.taxType == 'stacked' ? 1 : 0;

        taxes.forEach(element => {
            if (this.taxType == 'flat') {
                taxesAmount = Helper.add(taxesAmount, element.taxPercentage, afterDecimal);
            } else {
                taxesAmount = Helper.multiply(taxesAmount, Helper.division(Helper.add(element.taxPercentage, 100, afterDecimal), 100, afterDecimal), afterDecimal)
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
        return Helper.roundNum(total, afterDecimal)
    }
    calculateTax(afterDecimal: number) {
        //If the tax applied is Group Tax 

        if (this.taxes && Array.isArray(this.taxes) && this.taxes.length > 0 && this.taxType != "") {

            let total = this.total; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            let tempstackedTotal = 0
            const taxesTemp: any = []
            if (this.isInclusiveTax) {
                total = this.getBasePrice(total, this.taxes, afterDecimal)
            }
            if (this.taxType == "flat") { // flat tax calculate both tax separately from line total 
                this.taxes.forEach((tax: any) => {
                    const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
                this.taxes.forEach((tax: any) => {
                    tax.stackedTotal = Helper.roundNum(tempstackedTotal, afterDecimal)
                    const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal)
                    total = Helper.add(total, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
                    tempstackedTotal = taxAmount
                    taxesTemp.push(tax)
                });
            }
            this.taxPercentage = taxTotalPercentage;
            this.taxTotal = taxTotal;
            this.taxes = taxesTemp;
        } else {
            this.taxTotal = this.isInclusiveTax ? Helper.division(Helper.multiply(this.total, this.taxPercentage, afterDecimal), Helper.add(100, this.taxPercentage, afterDecimal), afterDecimal) : Helper.multiply(this.total, Helper.division(this.taxPercentage, 100, afterDecimal), afterDecimal);
        }
    }

    // calculateTotal(afterDecimal: number) {

    //     this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
    //     let total = 0;

    //     //Bill lines product can be [batch, serial, inventory]
    //     //inventory: lineqty * lineUnitCost => line total 
    //     //serial {serial:'',untitCost} sum of serial.unitCost=> line total 
    //     //batch {batch:'',unitCost,qty,prodDate,expireDate} sum of (batch.unitCost*batch*qty)=> line total 
    //     if (this.serials&&this.serials.length > 0) {
    //         this.qty = this.serials.length; 
    //         this.serials.forEach((element: any) => {
    //             element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
    //             if(!element.isDeleted)
    //             total = Helper.add(total, element.unitCost,afterDecimal)
    //         });
    //         this.subTotal = total;
    //         this.unitCost = Helper.division( total,this.serials.length,afterDecimal);

    //     } else if (this.batches&&this.batches.length > 0) {
    //         this.qty = 0; 
    //         this.batches.forEach((element: any) => {
    //             if(!element.isDeleted){
    //                 element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
    //                 this.qty+= element.qty
    //                 total += Helper.multiply(element.unitCost , element.qty,afterDecimal)
    //             }

    //         });
    //         this.subTotal = total;
    //         this.unitCost = Helper.division(total , this.qty,afterDecimal)
    //     } else {
    //         this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
    //         this.subTotal = Helper.multiply( this.qty ,this.unitCost ,afterDecimal)
    //     }

    //      this.total = this.subTotal


    //     if (this.taxId != null && this.taxId != "") {
    //         this.calculateTax(afterDecimal);
    //         if (!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
    //         {
    //             this.total = Helper.add(this.total,this.taxTotal,afterDecimal);
    //         }
    //     }else{
    //         this.taxPercentage = 0;
    //         this.taxTotal = 0 ;
    //         this.taxes = [];
    //     }







    // }

    //      calculateTotal(afterDecimal: number) {

    //         this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
    //         let total = 0;

    //         //Bill lines product can be [batch, serial, inventory]
    //         //inventory: lineqty * lineUnitCost => line total 
    //         //serial {serial:'',untitCost} sum of serial.unitCost=> line total 
    //         //batch {batch:'',unitCost,qty,prodDate,expireDate} sum of (batch.unitCost*batch*qty)=> line total 
    //         if (this.serials&&this.serials.length > 0) {
    //             this.qty = this.serials.length; 
    //             this.serials.forEach((element: any) => {
    //                 element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
    //                 if(!element.isDeleted)
    //                 total = Helper.add(total, element.unitCost,afterDecimal)
    //             });
    //             this.subTotal = total;
    //             this.unitCost = Helper.division( total,this.serials.length,afterDecimal);

    //         } else if (this.batches&&this.batches.length > 0) {
    //             this.qty = 0; 
    //             this.batches.forEach((element: any) => {
    //                 if(!element.isDeleted){
    //                     element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
    //                     this.qty+= element.qty
    //                     total += Helper.multiply(element.unitCost , element.qty,afterDecimal)
    //                 }

    //             });
    //             this.subTotal = total;
    //             this.unitCost = Helper.division(total , this.qty,afterDecimal)
    //         } else {
    //             this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
    //             this.subTotal = Helper.multiply( this.qty ,this.unitCost ,afterDecimal)
    //         }
    //          this.total = this.subTotal



    //          const lineItem1: LineItem = {
    //             id: this.id,
    //             description: this.productName,
    //             amount: this.subTotal,
    //             discountPercentage: this.discountPercentage,
    //             discountAmount: this.discountAmount,
    //             taxPercentage: this.taxPercentage, // Single tax rate
    //             taxes: this.taxes,
    //             taxType: this.taxType,
    //             taxId: this.taxId?? undefined  
    //         };


    //          const a = calculateLine(lineItem1, this.isInclusiveTax, this.applyDiscountBeforeTax, afterDecimal);
    //          console.log(">>>>>>>>>>>>>>>>>>")
    //          console.log( "line subTotal:", this.total, 
    //             "\nline discount:", a.lineDiscountTotal,
    //             "\nline tax:", a.lineTaxTotal,
    //             "\nline total:", a.lineTotal,
    //          )
    //          console.log(">>>>>>>>>>>>>>>>>>")
    //        this.discountTotal = a.lineDiscountTotal
    //        this.taxTotal = a.lineTaxTotal
    //        this.total = a.lineTotal
    //        this.taxPercentage = a.lineTaxPercentage
    //        this.taxes = a.lineTaxes



    //     //    if (this.taxId != null && this.taxId != "") {
    //     //         this.calculateTax(afterDecimal);
    //     //         if (!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
    //     //         {
    //     //             this.total = Helper.add(this.total,this.taxTotal,afterDecimal);
    //     //         }

    //     //     }else{
    //     //         this.taxPercentage = 0;
    //     //         this.taxTotal = 0 ;
    //     //         this.taxes = [];
    //     //     }







    //     }



    // }

    calculateTotal(afterDecimal: number) {

        this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
        let total = 0;

        //Bill lines product can be [batch, serial, inventory]
        //inventory: lineqty * lineUnitCost => line total 
        //serial {serial:'',untitCost} sum of serial.unitCost=> line total 
        //batch {batch:'',unitCost,qty,prodDate,expireDate} sum of (batch.unitCost*batch*qty)=> line total 
        if (this.serials && this.serials.length > 0) {
            this.qty = this.serials.length;
            this.serials.forEach((element: any) => {
                element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
                if (!element.isDeleted)
                    total = Helper.add(total, element.unitCost, afterDecimal)
            });
            this.subTotal = total;
            this.unitCost = Helper.division(total, this.serials.length, afterDecimal);

        } else if (this.batches && this.batches.length > 0) {
            this.qty = 0;
            this.batches.forEach((element: any) => {
                if (!element.isDeleted) {
                    element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
                    this.qty += element.qty
                    total += Helper.multiply(element.unitCost, element.qty, afterDecimal)
                }

            });
            this.subTotal = total;
            this.unitCost = Helper.division(total, this.qty, afterDecimal)
        } else {
            this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
            this.subTotal = Helper.multiply(this.qty, this.unitCost, afterDecimal)
        }
        this.total = this.subTotal



        const lineItem1: LineItem = {
            id: this.id,
            description: this.productName,
            amount: this.subTotal,
            discountPercentage: this.discountPercentage,
            discountAmount: this.discountAmount,
            taxPercentage: this.taxPercentage, // Single tax rate
            taxes: this.taxes,
            taxType: this.taxType,
            taxId: this.taxId ?? undefined,
            transactionDiscount: 0,
            discountIncludesTax: this.discountIncludesTax,
            supplierCreditDiscount: 0 
        };


        const a = calculateLine(lineItem1, this.isInclusiveTax, this.applyDiscountBeforeTax, afterDecimal);
        console.log(">>>>>>>>>>>>>>>>>>")
        console.log("line subTotal:", this.total,
            "\nline discount:", a.discount,
            "\nline tax:", a.taxTotal,
            "\nline total:", a.total,
        )
        console.log(">>>>>>>>>>>>>>>>>>")
        this.discountTotal = a.discount
        this.taxTotal = a.taxTotal
        this.total = a.total
        this.taxPercentage = a.totalTaxPercentage
        this.taxes = a.taxes
        this.baseAmount = a.basePrice
        this.taxableAmount = a.taxableAmount



        //    if (this.taxId != null && this.taxId != "") {
        //         this.calculateTax(afterDecimal);
        //         if (!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
        //         {
        //             this.total = Helper.add(this.total,this.taxTotal,afterDecimal);
        //         }

        //     }else{
        //         this.taxPercentage = 0;
        //         this.taxTotal = 0 ;
        //         this.taxes = [];
        //     }







    }



}