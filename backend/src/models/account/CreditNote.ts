import { Helper } from "@src/utilts/helper";
import { CreditNoteLine } from "./CreditNoteLine";
import { Invoice, TaxDetails } from "./Invoice";
import { Log } from "../log";
import { TimeHelper } from "@src/utilts/timeHelper";
import { TaxModel } from "./InvoiceLine";


export class CreditNote {
    /**
     * 
     * only when productId id not null and creditNoteLines.isWaste: false 
     * Credit Note Journals 
     * Inventory Assets	=> debit
     * Costs Of Goods Sold	=> credit 
     * 
     * Sales=> Debit 
     * Account Receivable => credit
     * 
     * Output Vat => debit
     * Charges Income => debit
     * Delivery Charge	=> debit
     * 
     * Discount=> credit
     */

    id = "";
    branchId = "";
    employeeId = "";
    invoiceId = ""; // to link creditNote to invoice 
    customerId = "";


    creditNoteNumber = ""; // auto generated 
    refrenceNumber = "";
    note = "";


    chargeId: string | null;
    chargeAmount = 0;
    chargePercentage = false
    chargeTotal = 0;
    includeCharges = false;// true only when invoice is fully refunded

    deliveryCharge = 0;

    discountId: string | null;
    discountAmount = 0;
    discountPercentage = false
    discountTotal = 0;


    subTotal = 0;
    total = 0;
    paidAmount = 0;// invoice paid amount 
    refundedAmount = 0;
    refundDue = 0;
    appliedAmount = 0;
    invoiceTotal = 0;

    creditNoteDate = new Date();
    createdAt = new Date();
    updatedDate = new Date()

    lines: CreditNoteLine[] = [];
    status = "";
    smallestCurrency = 0;
    roundingType = "normal";
    roundingTotal = 0;
    customerName = "";
    invoiceNumber = "";
    isInclusiveTax = false;
    attachment = [];
    usedCredit = 0
    remainingCredit = 0
    discountType = "";
    sourceType = "Cloud"


    logs: Log[] = [];
    creditTaxTotal = 0
    itemSubTotal = 0

    discountTaxDetails = {
        taxId: "",
        type: "",
        taxPercentage: 0,
        taxAmount: 0,
        taxes: []
    }


    chargesTaxDetails: null | TaxDetails;



    deliveryChargeTaxDetails = {
        taxId: "",
        type: "",
        taxPercentage: 0,
        taxTotal: 0,
        taxes: []
    }

    customerContact = ""
    subItem: CreditNoteLine[] = []
    invoiceOnlineStatus: string | null;
    companyId = ""
    customerEmail = ""
    branchCustomFields: any = null

    constructor() {
        this.chargeId = null;
        this.discountId = null;
        this.invoiceOnlineStatus = null;
        this.chargesTaxDetails = null
    }


    //only included when the invoice is fully refunded 
    set isChargesIncluded(includeCharges: boolean) {
        this.includeCharges = includeCharges;
    }



    chargeType = "chargeBeforeTax";

    code: string | null = null;
    ParseJson(json: any): void {
        for (const key in json) {

            if (key == "lines") {

                const linesTemp: CreditNoteLine[] = [];
                let creditnoteline: CreditNoteLine;
                json[key].forEach((line: any) => {

                    creditnoteline = new CreditNoteLine();
                    creditnoteline.ParseJson(line);
                    linesTemp.push(creditnoteline)
                })
                this.lines = linesTemp;
            } else if (key == 'chargesTaxDetails' && json[key] != "" && json[key] != null) {
                let temp = new TaxDetails()
                let opject = Helper.checkAndParseArrayOpjects(json[key])
                temp.ParseJson(opject)
                this.chargesTaxDetails = temp
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }

        }
    }

    afterDecimal = 3;
    // total of lines 
    get itemTotal(): number {
        let price = 0;
        this.lines.forEach(element => {
            const line = new CreditNoteLine();
            line.ParseJson(element)

            price = Helper.add(price, line.total, this.afterDecimal);

        });
        return price;
    }

    //calculate discount 
    get creditNoteDiscount(): number {
        if (this.discountPercentage) {
            return Helper.multiply(this.itemTotal, Helper.division(this.discountAmount, 100, this.afterDecimal), this.afterDecimal);
        } else {
            return this.discountAmount;
        }
    }


    //calculate total
    /**
     * 
     * @param invoice  //invoice data is used to calculate discount proportion 
     * @param afterDecimal 
     */
    calculateTotal(invoice: Invoice, afterDecimal: number) {
        this.total = 0;
        const invoiceDiscount = invoice.discountTotal; // discount appplied on invoice linked with this creditNote
        const rounding = 0.001;// to round discount amount to 3 decimal places 

        this.discountTotal = 0;
        this.subTotal = 0;
        let taxTotal = 0;
        this.afterDecimal = afterDecimal;
        if (invoice.discountType == "itemDiscount") {
            this.discountAmount = 0
            for (let index = 0; index < this.lines.length; index++) {
                const element = this.lines[index];
                const invoiceLine: any = invoice.lines.find((f: any) => f.id == element.invoiceLineId)
                element.isInclusiveTax = this.isInclusiveTax;
                element.calculateTotal(invoiceLine, afterDecimal);
                this.itemSubTotal = Helper.add(this.itemSubTotal, element.total, afterDecimal)
                taxTotal += Helper.add(taxTotal, element.taxTotal, afterDecimal)
                this.subTotal += Helper.roundNum(element.total, afterDecimal);
            }

        } else {
            for (let index = 0; index < this.lines.length; index++) {
                const element = this.lines[index];
                const invoiceLine: any = invoice.lines.find((f: any) => f.id == element.invoiceLineId)
                element.isInclusiveTax = this.isInclusiveTax;
                if (!element.isDeleted) {
                    element.calculateTotal(invoiceLine, afterDecimal);
                    this.itemSubTotal = Helper.add(this.itemSubTotal, element.total, afterDecimal)
                    this.subTotal = Helper.add(this.subTotal, element.total, afterDecimal);
                    taxTotal = Helper.add(taxTotal, element.taxTotal, afterDecimal);
                    if (invoiceLine) {
                        /**
                         * the code bellow will divide invoice total discount on each creditnote created (discountTotalAmount is percentage discount of each line )
                         * 
                         */
                        let discountTotalAmount = 0; // to calculate discount total on credit note ( discount perentage  of credit note from invoice )
                        if (this.discountAmount > 0) {
                            if (this.discountPercentage) {// when discount is percentage 
                                discountTotalAmount = Helper.multiply(element.total, Helper.division(this.discountAmount, 100, afterDecimal), afterDecimal);
                                discountTotalAmount = Helper.multiply(Math.round(Helper.division(discountTotalAmount, rounding, afterDecimal)), rounding, afterDecimal);

                            } else {
                                // when discount is cash 
                                const discountProp = Helper.division(invoiceLine.total, invoice.subTotal, afterDecimal); // to find invoiceline proportion of invoice total => invoiceline linked with creditnoteline  
                                const roundedDiscount = Helper.multiply(Math.round(Helper.division(discountProp, rounding, afterDecimal)), rounding, afterDecimal); // round amount of discount proportion
                                if (element.qty == invoiceLine.qty) // when invoice line is fully credit note 
                                {
                                    discountTotalAmount = Helper.multiply(invoiceDiscount, roundedDiscount, afterDecimal);
                                } else {


                                    let discount = Helper.division(roundedDiscount, invoiceLine.qty, afterDecimal) // divide the proportion on invoice qty 
                                    discount = Helper.multiply(Math.round(Helper.division(discount, rounding, afterDecimal)), rounding, afterDecimal); // round 
                                    if ((element.qty + invoiceLine.creditNoteQty) == invoiceLine.qty) // to check if this credite note is last qty refunded //invoiceLine.creditNoteQty is already existed credit not on line 
                                    {

                                        if (element.qty > 1) {
                                            const creditNoteLineDiscount = Helper.multiply(discount, (invoiceLine.creditNoteQty), afterDecimal) //total used discount from previous credit notes 
                                            discountTotalAmount = Helper.multiply(discount, Helper.sub(element.qty, 1, afterDecimal), afterDecimal); //   credit not qty -1 
                                            discountTotalAmount = Helper.add(discountTotalAmount, Helper.sub(roundedDiscount, Helper.add(discountTotalAmount, creditNoteLineDiscount, afterDecimal), afterDecimal), afterDecimal) // remaining discount prop for the last qty 
                                        } else {
                                            discountTotalAmount = Helper.multiply(discount, Helper.sub(invoiceLine.qty, 1, afterDecimal), afterDecimal);
                                            discountTotalAmount = Helper.sub(roundedDiscount, discountTotalAmount, afterDecimal);
                                        }

                                    } else {

                                        // when part of the invoice line is refunded 
                                        discountTotalAmount = Helper.multiply(discount, (element.qty), afterDecimal) // multiply divided amount by credit note qty 
                                    }


                                    discountTotalAmount = Helper.multiply(invoiceDiscount, discountTotalAmount, afterDecimal); //multiply invoiceDiscount by calculted discoun percantage 
                                }

                            }
                            this.discountTotal = Helper.add(this.discountTotal, discountTotalAmount, afterDecimal);
                        }
                    }
                }
            }
        }


        this.discountAmount = this.discountTotal
        this.total = this.subTotal;


        if (this.discountTotal > 0 && invoice.discountType != "itemDiscount") {
            this.total = Helper.sub(this.total, this.discountTotal, afterDecimal);
            // this.calculateDiscountTax(afterDecimal, this.discountTotal);
            // let total = Helper.sub(taxTotal, this.discountTaxDetails.taxTotal, afterDecimal) < 0 ? 0 : Helper.sub(this.total, this.discountTaxDetails.taxTotal, afterDecimal)
            // this.total = total
        }


        if (this.chargeTotal > 0 && this.chargesTaxDetails) {
            this.total = Helper.add(this.total, this.chargeTotal, afterDecimal);
            this.calculateChargeTax(afterDecimal, this.chargeTotal);
            if (!this.isInclusiveTax) {
                this.total = Helper.add(this.total, this.chargesTaxDetails.taxAmount, afterDecimal)
            }
            taxTotal = Helper.add(taxTotal, this.chargesTaxDetails.taxAmount, afterDecimal);
        }

        this.creditTaxTotal = taxTotal
        // this.calculateChargeTax(afterDecimal,this.chargeTotal);
        // this.total = Helper.add(this.total, this.chargesTaxDetails.taxTotal,afterDecimal ) 

        if (invoice.deliveryCharge > 0) {
            this.total = Helper.add(this.total, this.deliveryCharge, afterDecimal);
            // this.calculateDeliveryChargeTax(afterDecimal,this.deliveryCharge);
            // this.total = Helper.add(this.total,this.deliveryChargeTaxDetails.taxTotal,afterDecimal)
        }


        if (this.smallestCurrency != 0 && this.roundingType) {
            this.calculateRounding(afterDecimal);
        }

        this.total = Helper.add(this.total, this.roundingTotal, afterDecimal)

        console.log("SubTotallllllllllllllllllllllllllllllllllllll", this.subTotal)


    }


    // calculate credit Note Balance (total - (appliedCredit + refund))
    calculateRefundDue(afterDecimal: number) {
        const balance = Helper.sub(this.invoiceTotal, this.paidAmount, afterDecimal)
        if (this.paidAmount == this.invoiceTotal && this.total == this.invoiceTotal) {
            this.remainingCredit = Helper.sub(this.paidAmount, Helper.add(this.refundedAmount, this.appliedAmount, afterDecimal), afterDecimal)//(refundedAmount) total of applied on other bills + refunded 
        } else {
            if (this.paidAmount != 0) {
                const refundBalance = Helper.sub(this.paidAmount, (Helper.sub(this.invoiceTotal, this.total, afterDecimal)), afterDecimal)
                this.remainingCredit = refundBalance <= 0 ? 0 : Helper.sub((refundBalance), Helper.add(this.refundedAmount, this.appliedAmount, afterDecimal), afterDecimal)
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
            console
            this.roundingTotal = Helper.sub(roundingTotal, this.total, afterDecimal);

        }

        return 0;
    }



    calculateDiscountTax(afterDecimal: number, discountTotal: number) {
        //If the tax applied is Group Tax 
        if (this.discountTaxDetails.taxes && Array.isArray(this.discountTaxDetails.taxes) && this.discountTaxDetails.taxes.length > 0 && this.discountTaxDetails.type != "") {

            let total = discountTotal; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            const taxesTemp: any = []

            if (this.discountTaxDetails.type == "flat") { // flat tax calculate both tax separately from line total 
                this.discountTaxDetails.taxes.forEach((tax: any) => {
                    const taxAmount = this.isInclusiveTax ? Helper.division((total * tax.taxPercentage), (100 + tax.taxPercentage), afterDecimal) : Helper.multiply(total, (tax.taxPercentage / 100), afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal += taxAmount;
                    tax.totalAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.discountTaxDetails.type == "stacked") {// stacked tax both tax depened on each other 
                this.discountTaxDetails.taxes.forEach((tax: any) => {
                    const taxAmount = this.isInclusiveTax ? Helper.division((total * tax.taxPercentage), (100 + tax.taxPercentage), afterDecimal) : Helper.multiply(total, (tax.taxPercentage / 100), afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal += taxAmount
                    total += taxAmount;
                    tax.totalAmount = taxAmount
                    taxesTemp.push(tax)
                });
            }
            this.discountTaxDetails.taxPercentage = taxTotalPercentage;
            this.discountTaxDetails.taxAmount = taxTotal;
            this.discountTaxDetails.taxes = taxesTemp;
        } else {
            this.discountTaxDetails.taxAmount = this.isInclusiveTax ? Helper.division((discountTotal * this.discountTaxDetails.taxPercentage), (100 + this.discountTaxDetails.taxPercentage), afterDecimal) : Helper.multiply(discountTotal, (this.discountTaxDetails.taxPercentage / 100), afterDecimal);
        }
    }
    calculateDeliveryChargeTax(afterDecimal: number, deliveryCharge: number) {
        //If the tax applied is Group Tax 
        if (this.deliveryChargeTaxDetails.taxes && Array.isArray(this.deliveryChargeTaxDetails.taxes) && this.deliveryChargeTaxDetails.taxes.length > 0 && this.deliveryChargeTaxDetails.type != "") {

            let total = deliveryCharge; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            const taxesTemp: any = []

            if (this.deliveryChargeTaxDetails.type == "flat") { // flat tax calculate both tax separately from line total 
                this.deliveryChargeTaxDetails.taxes.forEach((tax: any) => {
                    const taxAmount = this.isInclusiveTax ? Helper.division((total * tax.taxPercentage), (100 + tax.taxPercentage), afterDecimal) : Helper.multiply(total, (tax.taxPercentage / 100), afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal += taxAmount;
                    tax.totalAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.deliveryChargeTaxDetails.type == "stacked") {// stacked tax both tax depened on each other 
                this.deliveryChargeTaxDetails.taxes.forEach((tax: any) => {
                    const taxAmount = this.isInclusiveTax ? Helper.division((total * tax.taxPercentage), (100 + tax.taxPercentage), afterDecimal) : Helper.multiply(total, (tax.taxPercentage / 100), afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal += taxAmount
                    total += taxAmount;
                    tax.totalAmount = taxAmount
                    taxesTemp.push(tax)
                });
            }
            this.deliveryChargeTaxDetails.taxPercentage = taxTotalPercentage;
            this.deliveryChargeTaxDetails.taxTotal = taxTotal;
            this.deliveryChargeTaxDetails.taxes = taxesTemp;
        } else {
            this.deliveryChargeTaxDetails.taxTotal = this.isInclusiveTax ? Helper.division((deliveryCharge * this.deliveryChargeTaxDetails.taxPercentage), (100 + this.deliveryChargeTaxDetails.taxPercentage), afterDecimal) : Helper.multiply(deliveryCharge, (this.deliveryChargeTaxDetails.taxPercentage / 100), afterDecimal);
        }
    }
    getBasePrice(total: number, taxes: TaxModel[], afterDecimal: number, taxType: string) {


        let taxesAmount = taxType == 'stacked' ? 1 : 0;

        taxes.forEach(element => {
            if (taxType == 'flat') {
                taxesAmount = Helper.add(taxesAmount, element.taxPercentage, afterDecimal);
            } else {
                taxesAmount = Helper.multiply(taxesAmount, Helper.division(Helper.add(element.taxPercentage, 100, afterDecimal), 100, afterDecimal), afterDecimal)
            }
        });

        if (taxType == 'flat') {
            let taxTotaltemp = 0;
            taxTotaltemp = Helper.division(Helper.add(100, taxesAmount, afterDecimal), 100, afterDecimal)
            total = Helper.division(total, taxTotaltemp, afterDecimal)
        } else if (taxType == 'stacked') {

            total = Helper.division(total, taxesAmount, afterDecimal)
        }

        console.log(total)
        return Helper.roundNum(total, afterDecimal)
    }
    calculateChargeTax(afterDecimal: number, chargeTotal: number) {
        //If the tax applied is Group Tax 
        if (this.chargesTaxDetails && this.chargesTaxDetails.taxes && Array.isArray(this.chargesTaxDetails.taxes) && this.chargesTaxDetails.taxes.length > 0 && this.chargesTaxDetails.type != "") {

            let total = chargeTotal; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            const taxesTemp: any = []
            if (this.isInclusiveTax && this.chargesTaxDetails.taxes.length > 0 && (this.chargesTaxDetails.type == "flat" || this.chargesTaxDetails.type == "stacked")) {
                total = this.getBasePrice(total, this.chargesTaxDetails.taxes, afterDecimal, this.chargesTaxDetails.type)
            }
            if (this.chargesTaxDetails.type == "flat") { // flat tax calculate both tax separately from line total 
                this.chargesTaxDetails.taxes.forEach((tax: any) => {
                    const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.chargesTaxDetails.type == "stacked") {// stacked tax both tax depened on each other 
                this.chargesTaxDetails.taxes.forEach((tax: any) => {
                    const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal)
                    total = Helper.add(total, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
                    taxesTemp.push(tax)
                });
            }
            this.chargesTaxDetails.taxPercentage = taxTotalPercentage;
            this.chargesTaxDetails.taxAmount = taxTotal;
            this.chargesTaxDetails.taxes = taxesTemp;
        } else {
            if (this.chargesTaxDetails)
                this.chargesTaxDetails.taxAmount = this.isInclusiveTax ? Helper.division(Helper.multiply(chargeTotal, this.chargesTaxDetails.taxPercentage, afterDecimal), Helper.add(100, this.chargesTaxDetails.taxPercentage, afterDecimal), afterDecimal) : Helper.multiply(chargeTotal, Helper.division(this.chargesTaxDetails.taxPercentage, 100, afterDecimal), afterDecimal);
        }
    }


    /** pos logs are receviced with createdAt as time stamp */
    parsePosLogs() {
        try {
            let logs: Log[] = []
            let log;
                    this.logs = Helper.checkAndParseArrayOpjects(this.logs)
            if (this.logs && Array.isArray(this.logs)) {
                this.logs.forEach(element => {
                    log = new Log();
                    log.ParseJson(element);
                    log.createdAt = TimeHelper.convertToDate(log.createdAt);
                    logs.push(log)
                });
            }
            this.logs = logs
        } catch (error) {
            console.log(error)

        }

    }
    /** the following function will merege to array of logs avoiding duplication  */
    setlogs(logs: any[]) {
        this.parsePosLogs()
        let mergedArray = this.logs.concat(logs);
        mergedArray = Helper.checkAndParseArrayOpjects(mergedArray)

        const uniqueArray = mergedArray.filter((event, index, self) => {
            // Create a unique key based on employeeId, action, and comment
            const uniqueKey = `${event.employeeId}-${event.action}-${event.comment}-${event.createdAt}`;
            // Check if the unique key has been seen before
            return index === self.findIndex(e =>
                `${e.employeeId}-${e.action}-${e.comment}-${event.createdAt}` === uniqueKey
            );
        });

        this.logs = logs.length > 0 ? uniqueArray : this.logs;
    }
    taxesDetails: any[] = [];
    setTaxesDetails() {
        try {

            this.lines.forEach(element => {
                console.log(element.taxTotal)
                console.log(element.subTotal)
                this.creditTaxTotal += element.taxTotal
                this.itemSubTotal += element.subTotal;
            });

            if (this.chargesTaxDetails) {
                this.creditTaxTotal += (+Number(this.chargesTaxDetails.taxAmount ?? 0))
            }

            this.lines.map((f) => {


                if (f.taxes && f.taxes.length == 0 || !f.taxes) {
                    let tax = this.taxesDetails.find((item: any) => item.taxId == f.taxId)


                    if (tax) {
                        let index = this.taxesDetails.indexOf(tax)
                        this.taxesDetails[index].total += f.taxTotal

                    } else {
                        this.taxesDetails.push({ taxId: f.taxId, taxName: f.taxName ?? "Tax " + f.taxPercentage + ' %', total: f.taxTotal, taxPercentage: f.taxPercentage })
                    }

                }


                if (f.taxes && f.taxes.length > 0) {
                    f.taxes.map((subTaxes: any) => {
                        let tax = this.taxesDetails.find((item: any) => item.taxId == subTaxes.taxId)


                        if (tax) {
                            let index = this.taxesDetails.indexOf(tax)
                            this.taxesDetails[index].total += subTaxes.taxAmount

                        } else {

                            this.taxesDetails.push({ taxId: subTaxes.taxId, taxName: subTaxes.taxName ?? "Tax " + subTaxes.taxPercentage + ' %', total: subTaxes.taxAmount, taxPercentage: subTaxes.taxPercentage })
                        }

                    })
                }
            },)



            if (this.chargesTaxDetails) {
                let tax = this.taxesDetails.find((item: any) => item.taxId == this.chargesTaxDetails?.taxId)

                if (this.chargesTaxDetails.taxes.length == 0) {
                    if (tax) {
                        let index = this.taxesDetails.indexOf(tax)
                        this.taxesDetails[index].total += this.chargesTaxDetails?.taxAmount

                    } else {
                        this.taxesDetails.push({ taxId: this.chargesTaxDetails.taxId, taxName: this.chargesTaxDetails.taxName ?? "Tax " + this.chargesTaxDetails.taxPercentage + ' %', total: this.chargesTaxDetails.taxAmount, taxPercentage: this.chargesTaxDetails.taxPercentage })
                    }
                }



                if (this.chargesTaxDetails.taxes && this.chargesTaxDetails.taxes.length > 0) {
                    this.chargesTaxDetails.taxes.map((subTaxes: any) => {
                        let tax = this.taxesDetails.find((item: any) => item.taxId == subTaxes.taxId)


                        if (tax) {
                            let index = this.taxesDetails.indexOf(tax)
                            this.taxesDetails[index].total += subTaxes.taxAmount

                        } else {

                            this.taxesDetails.push({ taxId: subTaxes.taxId, taxName: subTaxes.taxName ?? "Tax " + subTaxes.taxPercentage + ' %', total: subTaxes.taxAmount, taxPercentage: subTaxes.taxPercentage })
                        }

                    })
                }
            }
        } catch (error) {
            console.log(error)
        }
    }
}