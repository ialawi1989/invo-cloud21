import { Helper } from "@src/utilts/helper";
import { SupplierCreditLine } from "./supplierCreditLines";
import { calculateBill, calculateCredit, LineItem } from "./calculations";

export class SupplierCredit {
    id = "";
    supplierId = "";
    billingId = "";
    employeeId = "";
    branchId = "";

    supplierCreditNumber = "";
    reference = "";
    shipping = 0;
    total = 0;
    billingTotal = 0;
    paidAmount = 0;
    refundedAmount = 0;

    refundDue = 0;
    supplierCreditDate = new Date();
    createdAt = new Date();
    lines: SupplierCreditLine[] = [];

    note = "";
    isInclusiveTax = false;

    attachment = [];

    supplierName = "";
    billingNumber = "";
    payableAccountId: string | null;
    smallestCurrency = 0;
    roundingType = ""
    roundingTotal = 0
    allowBillOfEntry = false;
    discountTotal = 0
    supplierCreditDiscount: any = 0


    branchCustomFields: any = null
    companyId = "";
    supplierEmail = "";
    discountPercentage = false;
    applyDiscountBeforeTax = false;
    itemSubTotal=0;
    billingTaxTotal=0;
    constructor() {
        this.payableAccountId = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'lines') {
                const linesTemp: SupplierCreditLine[] = [];
                let lineTemp: SupplierCreditLine;
                json[key].forEach((line: any) => {
                    lineTemp = new SupplierCreditLine();
                    lineTemp.ParseJson(line);
                    linesTemp.push(lineTemp);
                })
                this.lines = linesTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }
    afterDecimal = 3;

    // calculateTotal(afterDecimal: number) {

    //     let total = 0;
    //     this.afterDecimal = afterDecimal;
    //     this.lines.forEach(element => {
    //         element.isInclusiveTax = this.isInclusiveTax
    //         if (!element.isDeleted) {
    //             element.calculateTotal(afterDecimal)
    //             total = Helper.add(total, element.total, afterDecimal);
    //         }


    //     });
    //     this.total = total;

    //     this.calculateRounding(afterDecimal);
    //     this.total = Helper.add(this.total, this.roundingTotal, afterDecimal)
    // }


    calculateTotal(afterDecimal: number) {
        let total = 0;
        let taxTotal = 0
        let discountTotal = 0
        let supplierDiscountTotal = 0
        const items: any[] = []
        this.lines.forEach(element => {
             if (!element.isDeleted) {
                element.isInclusiveTax = this.isInclusiveTax;
                element.calculateTotal(afterDecimal);}
        });

        const a = calculateCredit(this.lines, afterDecimal);
        this.itemSubTotal = a.subtotal
        total = a.total
        this.discountTotal = a.discount

        this.lines.forEach(element => {
            const match = a.lines.find(nl => nl.id === element.id);
            if (match) {
                element.taxes = match.taxes ?? element.taxes
                element.taxTotal = match.taxTotal ?? element.taxTotal
                element.taxPercentage = match.taxPercentage ?? element.taxPercentage
                element.taxableAmount = match.taxableAmount ?? element.taxableAmount
            }
        })











        // this.lines.forEach(element => {
        //     if (!element.isDeleted) {
        //         element.isInclusiveTax = this.isInclusiveTax;
        //         if (element.parentId == null || element.parentId == "") {
        //             element.calculateTotal(afterDecimal);
        //             this.itemSubTotal = Helper.add(this.itemSubTotal,element.subTotal,afterDecimal);
        //             this.billingTaxTotal = Helper.add(this.billingTaxTotal,element.taxTotal,afterDecimal);
        //             total = Helper.add(total,element.total,afterDecimal);
        //         }
        //     }
        // });

        this.total = Helper.add(total, this.shipping, afterDecimal);
        this.calculateRounding(afterDecimal);
        this.total = Helper.add(this.total, this.roundingTotal, afterDecimal)

    }

    calculateRefundDue() {

        const balance = Helper.sub(this.billingTotal, this.paidAmount, this.afterDecimal)

        if (this.paidAmount == this.billingTotal && this.total == this.billingTotal) {
            this.refundDue = Helper.sub(this.paidAmount, this.refundedAmount, this.afterDecimal) //(refundedAmount) total of applied on other bills + refunded 

        } else {
            if (balance > 0 && this.paidAmount > 0) {
                this.refundDue = Helper.sub(balance, this.refundedAmount, this.afterDecimal)
            }
        }


    }
    calculateRounding(afterDecimal: number) {
        if (this.smallestCurrency == 0 || this.smallestCurrency == null || this.smallestCurrency == undefined) {

            this.smallestCurrency = Helper.division(1, Helper.roundNum((Math.pow(10, parseInt(afterDecimal.toString()))), afterDecimal), afterDecimal)
            this.roundingType = 'normal'
        }

        if (this.smallestCurrency > 0) {
            let roundingTotal = 0;
            switch (this.roundingType) {
                case "normal":
                    roundingTotal = Helper.multiply(Math.round(Helper.division(this.total, this.smallestCurrency, afterDecimal)), this.smallestCurrency, afterDecimal);
                    console.log(roundingTotal)
                    break;
                case "positive":

                    roundingTotal = Helper.multiply(Math.ceil(Helper.division(this.total, this.smallestCurrency, afterDecimal)), this.smallestCurrency, afterDecimal);
                    break;
                case "negative":
                    roundingTotal = Helper.roundNum(Math.trunc(Helper.division(this.total, this.smallestCurrency, afterDecimal)), afterDecimal)
                    roundingTotal = Helper.multiply(roundingTotal, this.smallestCurrency, afterDecimal)
                    break;
                default:
                    break;
            }

            this.roundingTotal = Helper.sub(roundingTotal, this.total, afterDecimal);

        }

        return 0;
    }

    setData() {
        if (this.supplierId == null || this.supplierId == "") {
            this.supplierId = this.lines[0].supplierId
            this.supplierName = this.lines[0].supplierName
        }

        if (this.billingId == null || this.billingId == "") {
            this.billingNumber = this.lines.map(item => item.billingNumber).join(',');
        }
    }

    setDiscountTotal() {
        this.discountTotal = 0
        this.lines.forEach(element => {
            this.discountTotal += parseFloat(element.supplierCreditDiscount as any);
        });
    }
}