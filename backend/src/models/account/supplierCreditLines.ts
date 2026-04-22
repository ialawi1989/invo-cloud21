import { Helper } from "@src/utilts/helper";
import { TaxModel } from "./InvoiceLine";
import { allocatePartialReturn, calculateCreditLineDiscountAmount, calculateCreditNoteLine, calculateTax } from "./calculations";
import { calculateLine, LineItem } from './calculations';


export class SupplierCreditLine {
    id = "";
    billingLineId = "";
    supplierCreditId = "";
    note = "";
    productId: string | null;
    accountId = "";
    employeeId = "";

    total = 0;
    subTotal = 0;

    taxId: string | null;
    taxTotal = 0;
    taxes: TaxModel[] = []   // empty when selected tax  is not Group tax 
    taxType = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;
    productType = "";


    createdAt = new Date();
    serials: SupplierCreditLine[] = [];
    batches: SupplierCreditLine[] = [];


    serial = "";
    batch = "";
    parentId: string | null;
    prodDate = new Date();
    expireDate = new Date();
    isDeleted = false;

    unitCost = 0;
    qty = 0;

    barcode = "";
    UOM = "";

    maxQty = 0
    isInclusiveTax = false;
    selectedItem: any;
    return = true;

    baseAmount = 0;
    discountTotal = 0
    discountAmount = 0;
    supplierCreditDiscount = 0
    applyDiscountBeforeTax = true;
    discountPercentage: boolean = true;

    /** for edit */
    oldQty = 0;
    oldUnitCost = 0
    supplierId = "";
    supplierName = "";
    billingNumber = "";
    billQty = 0
    totalReturnedQty = 0
    companyId = "";
    branchId = "";
    discountIncludesTax = false;
    taxableAmount = 0;
    constructor() {
        this.taxId = null;
        this.productId = null;
        this.parentId = null;
    }
    isNew = true
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
            } else (key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
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
    calculateTax(afterDecimal: number, getBaseAmount = true) {
        //If the tax applied is Group Tax 
        if (this.taxes && this.taxes.length > 0) {
            let total = this.total; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            if (this.isInclusiveTax && getBaseAmount) {
                total = this.getBasePrice(total, this.taxes, afterDecimal)
            }
            const taxesTemp: any = []
            console.log("calculateTax", total)


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
                    const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal)
                    total = Helper.add(total, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
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

    calculateLineDiscountAmount(line: any, afterDecimal: number) {
        // const a = calculateCreditLineDiscountAmount(line, this.qty, afterDecimal);
        this.discountTotal = allocatePartialReturn(line.discountTotal, line.qty, this.totalReturnedQty, this.qty, line.returnedDiscountTotal, afterDecimal)
        this.supplierCreditDiscount = allocatePartialReturn(line.billDiscount, line.qty, this.totalReturnedQty, this.qty, line.returnedSupplierDiscountTotal, afterDecimal)
    }

    calculateTotal(afterDecimal: number) {

        this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
        let total = 0;
        let qty = 0;
        if (this.serials.length > 0) {
            this.serials.forEach((element: any) => {
                if (!element.isDeleted) {
                    qty += 1;
                    element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
                    total = Helper.add(total, element.unitCost, afterDecimal)
                }
            });
            this.qty = qty;
            this.subTotal = total;
            this.unitCost = Helper.division(total, this.qty, afterDecimal);

        } else if (this.batches.length > 0) {

            this.batches.forEach((element: any) => {
                if (!element.isDeleted) {
                    element.unitCost = Helper.roundDecimal(element.unitCost, afterDecimal)
                    qty = Helper.add(qty, element.qty, afterDecimal)
                    total = Helper.add(total, Helper.multiply(element.unitCost, element.qty, afterDecimal), afterDecimal)
                }

            });
            this.qty = qty;
            this.subTotal = total;
            this.unitCost = Helper.division(total, this.qty, afterDecimal);
        } else {
            this.unitCost = Helper.roundDecimal(this.unitCost, afterDecimal)
            this.subTotal = Helper.multiply(this.qty, this.unitCost, afterDecimal)
        }

        this.total = this.subTotal

        this.baseAmount = this.total;
        const item: LineItem = {
            id: this.id,
            description: "",
            amount: this.subTotal,
            discountPercentage: this.discountPercentage,
            discountAmount: this.discountAmount,
            taxPercentage: this.taxPercentage, // Single tax rate
            taxes: this.taxes,
            taxType: this.taxType,
            taxId: this.taxId ?? undefined,
            transactionDiscount: this.supplierCreditDiscount,
            discountIncludesTax: this.discountIncludesTax,
            supplierCreditDiscount: this.supplierCreditDiscount,
            discountTotal: this.discountTotal
        };


        const a = calculateCreditNoteLine(item, this.isInclusiveTax, this.applyDiscountBeforeTax, afterDecimal);
        if (a) {
            this.baseAmount = a.basePrice;
            this.discountTotal = a.discountTotal??this.discountTotal;
            this.total = a.total;
            this.taxPercentage = a.totalTaxPercentage;
            this.taxTotal = a.taxTotal;
            this.taxes = a.taxes;
            this.taxableAmount = a.taxableAmount;
        }
    }


    // calculateTotal(afterDecimal:number){

    //     this.unitCost = Helper.roundNum(this.unitCost,afterDecimal)
    //     let total =0;
    //     let qty = 0;
    //     if(this.serials.length>0)
    //     {
    //         this.serials.forEach((element:any) => {
    //             if(!element.isDeleted){
    //             qty +=1;
    //             element.unitCost = Helper.roundNum(element.unitCost,afterDecimal) 
    //             total = Helper.add(total,element.unitCost,afterDecimal)
    //         }
    //         });
    //         this.qty = qty;
    //         this.subTotal = total;
    //         this.unitCost = Helper.division (total,this.qty,afterDecimal) ; 

    //     }else  if(this.batches.length>0)
    //     {

    //         this.batches.forEach((element:any) => {
    //             if(!element.isDeleted){
    //                 element.unitCost = Helper.roundDecimal(element.unitCost,afterDecimal) 
    //                 qty= Helper.add(qty,element.qty,afterDecimal)
    //                 total = Helper.add(total,Helper.multiply(element.unitCost , element.qty,afterDecimal),afterDecimal)
    //             }

    //         });
    //         this.qty = qty;
    //         this.subTotal = total;
    //         this.unitCost = Helper.division (total,this.qty,afterDecimal) ;
    //     }else{
    //         this.unitCost =  Helper.roundDecimal(this.unitCost,afterDecimal) 
    //         this.subTotal = Helper.multiply(this.qty , this.unitCost,afterDecimal)
    //     }



    //     this.total = this.subTotal
    //     if (this.taxId != null || this.taxId != "" ) {
    //         this.calculateTax(afterDecimal);
    //         if(!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
    //         {
    //             this.total = Helper.add(this.total,this.taxTotal,afterDecimal);
    //         }  
    //     } else{
    //         this.taxPercentage = 0;
    //         this.taxTotal = 0 ;
    //         this.taxes = []
    //     }

    // }

}