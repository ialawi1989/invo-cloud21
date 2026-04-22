import moment from "moment";
import { Billing } from "./Billing";

import { Helper } from "@src/utilts/helper";
import { Log } from "pkijs";
import { TaxModel } from "./InvoiceLine";


export class BillingLine {
    id = "";
    note = "";
    barcode = "";   



    qty = 0;
    unitCost = 0;
    total = 0;
    subTotal = 0;
    taxTotal = 0;

    billingId = "";
    productId: string | null; // if productId is not null and bill is not draft the bill will affect on line's account journal 
    accountId = ""; // affected account can only be of parentType ['Expense','Current Assets','Other Current Assets','Fixed Assets','Costs of Goods Sold','Operating Expense']
    employeeId ="";
    
    taxId: string | null;
    taxes:TaxModel[] = []  // empty when selected tax  is not Group tax 
    taxType = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;

    serials:any [] = [];
    batches:any [] = [];
    isInclusiveTax = false;
    selectedItem:any={};


    serial="";
    batch="";
    prodDate=new Date();
    expireDate= new Date();
    isDeleted =false;
    //TODO: ADD TO DBS
    parentId:string|null; // For serials and batches

     UOM ="";
    productType ="";


    maxQty=0 //for supplier credit

    accountName=""
    createdAt=new Date();
    SIC=""; /**Supplier Item Code*/
    isReturned= false;

    productName=""
    constructor() {
        this.productId = null;
        this.taxId = null;
        this.parentId = null;
    }


    ParseJson(json: any): void {
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
            }else{
                this[key as keyof typeof this] = json[key];
            } 
        }
    }

    calculateTaxPercentage(){
        let total =0;
        this.taxes.forEach((element:any) => {
            total += element.taxPercentage
        });
        this.taxPercentage = total;
    }

    
    calculateTax(afterDecimal: number) {
        //If the tax applied is Group Tax 

        if (this.taxes && Array.isArray(this.taxes) && this.taxes.length > 0 && this.taxType != "") {

            let total = this.total; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            let tempstackedTotal = 0 
            const taxesTemp: any = []

            if (this.taxType == "flat") { // flat tax calculate both tax separately from line total 
                this.taxes.forEach((tax: any) => {
                    const taxAmount = this.isInclusiveTax ? Helper.division(Helper.multiply(total ,tax.taxPercentage,afterDecimal), Helper.add(100 , tax.taxPercentage,afterDecimal), afterDecimal) : Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal += taxAmount,afterDecimal;
                    tax.taxAmount = taxAmount,afterDecimal
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
                this.taxes.forEach((tax: any) => {
                    tax.stackedTotal =  Helper.roundNum(tempstackedTotal,afterDecimal)
                    const taxAmount = this.isInclusiveTax ? Helper.division(Helper.multiply(total , tax.taxPercentage,afterDecimal), Helper.add(100 , tax.taxPercentage,afterDecimal), afterDecimal) : Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal +=  taxAmount
                    total +=  taxAmount;
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

        this.unitCost = Helper.roundDecimal(this.unitCost, afterDecimal)
        let total = 0;

        //Bill lines product can be [batch, serial, inventory]
        //inventory: lineqty * lineUnitCost => line total 
        //serial {serial:'',untitCost} sum of serial.unitCost=> line total 
        //batch {batch:'',unitCost,qty,prodDate,expireDate} sum of (batch.unitCost*batch*qty)=> line total 
        if (this.serials&&this.serials.length > 0) {
            this.qty = this.serials.length; 
            this.serials.forEach((element: any) => {
                element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
                if(!element.isDeleted)
                total += element.unitCost
            });
            this.subTotal = total;
            this.unitCost = Helper.division( total,this.serials.length,afterDecimal);

        } else if (this.batches&&this.batches.length > 0) {
            this.qty = 0; 
            this.batches.forEach((element: any) => {
                if(!element.isDeleted){
                    element.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
                    this.qty+= element.qty
                    total += Helper.multiply(element.unitCost , element.qty,afterDecimal)
                }
       
            });
            this.subTotal = total;
            this.unitCost = Helper.division(total , this.qty,afterDecimal)
        } else {
            this.unitCost = Helper.roundNum(this.unitCost, afterDecimal)
            this.subTotal = Helper.multiply( this.qty ,this.unitCost ,afterDecimal)
        }

         this.total = this.subTotal
        if (this.taxId != null && this.taxId != "") {

            this.calculateTax(afterDecimal);
            if (!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
            {
                this.total += this.taxTotal;
            }
        }else{
            this.taxPercentage = 0;
            this.taxTotal = 0 ;
            this.taxes = [];
        }

    }



}

export class Billing2 {
    id = "";
    billingNumber = ""; //Unique auto genereted 
    reference = "";
    status = "";

    employeeId = "";
    supplierId = "";
    branchId = ""
    purchaseOrderId: string | null;// to indicate either this bill is created from purchase order 
    recurringBillId: string | null

    branchName = ""

    dueDate:Date|null = new Date();
    createdAt = new Date();
    billingDate = new Date();

    balance = 0
    paidAmount = 0
    appliedCredit = 0
    refunded = 0;
    shipping = 0;
    total = 0;


    lines: BillingLine[] = [];


    itemSubTotal = 0;
    billingTaxTotal = 0;


    isInclusiveTax = false;


    supplierName = "";

    //TODO : DROP THIS 
    mediaId: string | null;
    mediaUrl = "";

    attachment: [] = [];
    productType = "";

    currentBillingStatus = "";

    billingPayments: any[] = [];

    supplierVatNumber = "";
    paymentTerm: "net7"|"net10"|"net15"|"net30"|"net60"|"net90"|"custome"|"endOfTheMonth"|"onReceiptDue";

    payableAccountId: string | null;

    smallestCurrency=0
    roundingType="";
    roundingTotal = 0


    constructor() {
        this.purchaseOrderId = null;
        this.recurringBillId = null;
        this.mediaId = null;
        this.payableAccountId = null
        this.paymentTerm ="custome";

    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "lines") {
                const linesTemp: BillingLine[] = [];
                let billingLine: BillingLine;
                json[key].forEach((line: any) => {
                    billingLine = new BillingLine();
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
        this.dueDate = this.dueDateFromTerm()
    }
    dueDateFromTerm():Date|null{
        switch (this.paymentTerm) {
            case 'net7':
                this.dueDate = new Date(moment(this.billingDate).add(7, 'day').format())
                break;
            case 'net10':
                this.dueDate = new Date(moment(this.billingDate).add(10, 'day').format())
                break;
            case 'net15':
                this.dueDate = new Date(moment(this.billingDate).add(15, 'day').format())
                break;
            case 'net30':
                this.dueDate = new Date(moment(this.billingDate).add(30, 'day').format())
                break;
            case 'net60':
                this.dueDate = new Date(moment(this.billingDate).add(60, 'day').format())
                break;
            case 'net90':
                this.dueDate = new Date(moment(this.billingDate).add(90, 'day').format())
                break;
            case 'onReceiptDue':
                this.dueDate = new Date(moment(this.billingDate).endOf('day').format())
                break;
            case 'endOfTheMonth':
                this.dueDate = new Date(moment(this.billingDate).endOf('month').format())
                break;
            case 'custome':
                this.dueDate = this.dueDate
                break;
            default:
                this.dueDate = new Date(moment(this.billingDate).endOf('day').format())
                break;
        }
        return this.dueDate;

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
        this.itemSubTotal = 0;
        this.billingTaxTotal = 0
        this.total = 0
        this.lines.forEach(element => {
            if (!element.isDeleted) {
                element.isInclusiveTax = this.isInclusiveTax;
                if (element.parentId == null || element.parentId == "") {
                    element.calculateTotal(afterDecimal);
                    this.itemSubTotal += element.subTotal;
                    this.billingTaxTotal += element.taxTotal;
                    total += element.total;
                }
            }
        });

        this.total = total + this.shipping;
        this.calculateRounding(afterDecimal);
        console.log(this.total)
        this.total = Helper.add(this.total,this.roundingTotal,afterDecimal)
        console.log(this.total)
        
        
    }

    setStatus() {
        this.appliedCredit += Number(this.refunded);
        const paidTotal = this.paidAmount + this.appliedCredit;
        const billBalance = this.total - Number(this.refunded);


        this.balance = this.total - (paidTotal)

        if (this.status != "Draft" && this.balance == this.total && billBalance > 0) {
            this.status = "Open"
        } else {
            if (billBalance != 0) {
                if (this.paidAmount >0&&this.balance <= 0) {
                    this.status = "Paid"
                } else if (this.paidAmount >0 &&this.balance < this.total) {
                    this.status = "Partially Paid"
                }
            } else {

                this.status = "Closed"
                if (this.refunded == 0 || this.refunded == null) {
                    this.status = "Open"

                }
            }



        }
    }

    calculateRounding(afterDecimal: number) {
        if(this.smallestCurrency==0)
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
            console.log(     this.roundingTotal)
        }
        
    }
    
}


export class RecurringBill {
    id =""; 
    name =""; 
    branchId:null|string = null
    createdAt= new Date(); 
    updatedDate= new Date(); 
    type = "sechedule"
    supplierId:null|string = null
    startDate :Date = new Date() 
     endDate :null|Date = null
     endTerm = 'none'
     repeatData = {}
     billCreatedBefore:Number= 0
     transactionDetails :any = {}
     hasBills = false
    //  getTransactionDetails():any|null{
    //     this.transactionDetails = new Billing()
    //     this.transactionDetails.ParseJson(this.transactionDetails)
    //     return this.transactionDetails;

    // }

     

    constructor(){}

    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "transactionDetails" && json[key]!=='{}') {
                let billingTemp=  new Billing();
                billingTemp.ParseJson(json[key])
                this.transactionDetails = billingTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }


    

}