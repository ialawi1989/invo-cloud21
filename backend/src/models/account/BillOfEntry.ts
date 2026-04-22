import { Helper } from "@src/utilts/helper";
import moment from "moment";
import { Log } from "../log";
import { TaxModel } from "./InvoiceLine";

export class BillOfEntry {

    id:string|null;
    billingOfEnrtyNumber = ""; //Unique auto genereted 
    reference = "";
    status = "";
    billingId=""
    employeeId = "";
    supplierId = "";
    branchId = ""

    branchName = ""

 
    createdAt = new Date();
    billingOfEntryDate = new Date();

    balance = 0
    total = 0;


    lines: BillOfEntryLine[] = [];


    itemSubTotal = 0;
    taxTotal = 0;


    isInclusiveTax = false;


    supplierName = "";

    //TODO : DROP THIS 
    mediaId: string | null;
    mediaUrl = "";

    attachment:any [] = [];
    productType = "";

    currentBillingStatus = "";

    billingPayments: any[] = [];
    logs: Log[] = [];
    supplierVatNumber = "";
    paymentTerm: "net7" | "net10" | "net15" | "net30" | "net60" | "net90" | "custome" | "endOfTheMonth" | "onReceiptDue";



    smallestCurrency = 0
    roundingType = "";
    roundingTotal = 0

    customFields: any[] = []
    branchCustomFields:any=null

    paymentMethodId = "";
    paymentMethodAccountId = "";
    note="";
    supplierCountry = "";
    customDutyTotal =0 ;
    billingNumber="";
    paymentMethodName = ""
    constructor() {

        this.mediaId = null;

        this.paymentTerm = "custome";
        this.id = null

    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "lines") {
                const linesTemp: BillOfEntryLine[] = [];
                let billingLine: BillOfEntryLine;
                json[key].forEach((line: any) => {
                    billingLine = new BillOfEntryLine();
                    billingLine.ParseJson(line);
                    linesTemp.push(billingLine);
                });
                this.lines = linesTemp;
            } else {
                if (key in this) {
                
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
       
    }

    /**
     * 
     * Billing Journals 
     * 
     * billingLines.accountId => Debit  billingLines.amount
     * Account Receivable => credit billig.total 
     * 
     * 
     */

    calculateTotal(afterDecimal: number) {
        let total = 0;
        this.customDutyTotal = 0;
        this.taxTotal = 0
        this.total = 0
        this.lines.forEach(element => {
            if (!element.isDeleted) {
                element.isInclusiveTax = this.isInclusiveTax;
                if (element.parentId == null || element.parentId == "") {
                    element.calculateTotal(afterDecimal);
                    this.customDutyTotal = Helper.add(this.customDutyTotal, element.customDuty, afterDecimal);
                    this.taxTotal = Helper.add(this.taxTotal, element.taxTotal, afterDecimal);
                    this.total = Helper.add(this.total,element.totalPaidAmount, afterDecimal);
                }
            }
        });
     
        this.calculateRounding(afterDecimal);
        this.total = Helper.add(this.total, this.roundingTotal, afterDecimal)


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
}


export class BillOfEntryLine {
    id = "";
    note = "";



    qty = 0;
    unitCost = 0;
    total = 0;
    subTotal = 0;
    taxTotal = 0;

    billOfEntryId = "";
    productId: string | null; // if productId is not null and bill is not draft the bill will affect on line's account journal 
    employeeId = "";

    taxId: string | null;
    taxes: TaxModel[] = []  // empty when selected tax  is not Group tax 
    taxType = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;

    serials: any[] = [];
    batches: any[] = [];
    isInclusiveTax = false;
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

    productName = ""
    customDuty = 0
    customDutyTaxTotal = 0;
    billingLineId= "";
    totalPaidAmount = 0 
    taxableAmount = 0 

    discountTotal = 0 
    billDiscount =0;
    transactionDiscountTotal = 0
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
                    const taxAmount = this.isInclusiveTax ? Helper.division(Helper.multiply(total, tax.taxPercentage, afterDecimal), Helper.add(100, tax.taxPercentage, afterDecimal), afterDecimal) : Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                    taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
                    tax.taxAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
                this.taxes.forEach((tax: any) => {
                    tax.stackedTotal = Helper.roundNum(tempstackedTotal, afterDecimal)
                    const taxAmount = this.isInclusiveTax ? Helper.division(Helper.multiply(total, tax.taxPercentage, afterDecimal), Helper.add(100, tax.taxPercentage, afterDecimal), afterDecimal) : Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
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
        this.subTotal =  this.subTotal
        this.transactionDiscountTotal = Helper.add(this.discountTotal, this.billDiscount, afterDecimal)
        this.taxableAmount = Helper.add(Helper.sub(this.subTotal,this.transactionDiscountTotal) , this.customDuty)
        this.total =    this.taxableAmount
    

        if (this.taxId != null && this.taxId != "") {
            this.calculateTax(afterDecimal);
            if (!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
            {
                this.total = Helper.add(this.total, this.taxTotal, afterDecimal);
            }
        } else {
            this.taxPercentage = 0;
            this.taxTotal = 0;
            this.taxes = [];
        }

        this.totalPaidAmount = Helper.add(this.taxTotal,this.customDuty,afterDecimal)
    }



}