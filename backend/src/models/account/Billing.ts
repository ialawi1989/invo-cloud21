
import { Helper } from "@src/utilts/helper";
import { BillingLine } from "./BillingLine";
import { Log } from "../log";
import moment from "moment";
import { calculateBill, LineItem } from "./calculations";



export class Billing {
    id = "";
    billingNumber = ""; //Unique auto genereted 
    reference = "";
    status = "";
    note : string | null = null;
    employeeId = "";
    supplierId = "";
    branchId = ""
    purchaseOrderId: string | null;// to indicate either this bill is created from purchase order 
    purchaseNumber: string|null;
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
    discountPercentage:boolean = true
    discountAmount=0
    discountTotal = 0
    billDiscount = 0
    applyDiscountBeforeTax:boolean= true


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
    logs: Log[] = [];
    supplierVatNumber = "";
    paymentTerm: "net7"|"net10"|"net15"|"net30"|"net60"|"net90"|"custome"|"endOfTheMonth"|"onReceiptDue";

    payableAccountId: string | null;

    smallestCurrency=0
    roundingType="";
    roundingTotal = 0

    customFields:any[]=[]
    branchCustomFields:any=null
    allowBillOfEntry  = false;
    internationalSupplier = false;
    billOfEntryId :string| null;
    billingOfEnrtyNumber :string|null;
    billingOfEnrtyTotal=0;
    billingOfEnrtyDate=0;
    companyId= "";
    supplierEmail ="";
    discountIncludesTax=false;

    constructor() {
        this.billOfEntryId = null;
        this.billingOfEnrtyNumber = null;
        this.purchaseOrderId = null;
        this.purchaseNumber = null;
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

    //  calculateTotal(afterDecimal: number) {
    //     let total = 0;
    //     this.itemSubTotal = 0;
    //     this.billingTaxTotal = 0
    //     this.total = 0

    //     let items : LineItem[] = []

    //     this.lines.forEach(element => {
    //         if (!element.isDeleted) {
    //             element.isInclusiveTax = this.isInclusiveTax;
    //             element.applyDiscountBeforeTax = this.applyDiscountBeforeTax;
    //             if (element.parentId == null || element.parentId == "") {
    //                 element.calculateTotal(afterDecimal)
    //                let item:LineItem =  {
    //                     id: element.id,
    //                     description: element.productName,
    //                     amount: element.subTotal,
    //                     discountPercentage: element.discountPercentage,
    //                     discountAmount: element.discountAmount,
    //                     taxPercentage: element.taxPercentage, // Single tax rate
    //                     taxId: element.taxId??undefined,
    //                     taxes: element.taxes,
    //                     taxType: element.taxType
    //                 };
    //                items.push(item)
    //             }
    //         }
    //     });

    //     console.log(items)



    //     const a = calculateBill(items, this.isInclusiveTax, this.discountAmount, this.discountPercentage, this.applyDiscountBeforeTax, afterDecimal);
    //     this.itemSubTotal= a.subtotal
    //     total = a.total
    //     this.discountTotal = a.discount
    //     this.billingTaxTotal = a.tax

        
    //     console.log(">>>>>>>>bill>>>>>>>>>>")
    //     console.log("bill subTotal:", a.subtotal, 
    //         "bill total:", a.total,  
    //         "\nbill discount:", a.discount,
    //         "\nbill tax:", a.tax,
    //         "\nbill lines:", a.lineDetails 
    //      )
    //      console.log(">>>>>>>>end>>>>>>>>>>")

        


    //     // this.lines.forEach(element => {
    //     //     if (!element.isDeleted) {
    //     //         element.isInclusiveTax = this.isInclusiveTax;
    //     //         if (element.parentId == null || element.parentId == "") {
    //     //             element.calculateTotal(afterDecimal);
    //     //             this.itemSubTotal = Helper.add(this.itemSubTotal,element.subTotal,afterDecimal);
    //     //             this.billingTaxTotal = Helper.add(this.billingTaxTotal,element.taxTotal,afterDecimal);
    //     //             total = Helper.add(total,element.total,afterDecimal);
    //     //         }
    //     //     }
    //     // });

    //     this.total = Helper.add(total , this.shipping,afterDecimal);
    //     this.calculateRounding(afterDecimal);
    //     this.total = Helper.add(this.total,this.roundingTotal,afterDecimal)
 
        
    // }

    calculateTotal(afterDecimal: number) {
        let total = 0;
        this.itemSubTotal = 0;
        this.billingTaxTotal = 0
        this.total = 0
        this.billDiscount = 0

        let items : LineItem[] = []
        let index = 0

        this.lines.forEach(element => {
            if (!element.isDeleted) {
                element.isInclusiveTax = this.isInclusiveTax;
                element.applyDiscountBeforeTax = this.applyDiscountBeforeTax;
                element.index = index;
                element.discountIncludesTax = this.discountIncludesTax;
                index++; 
                if (element.parentId == null || element.parentId == "") {
                    
                    element.calculateTotal(afterDecimal)
                   let item:LineItem =  {
                        id: element.id?element.id:String(element.index),
                        description: element.productName,
                        amount: element.subTotal,
                        discountPercentage: element.discountPercentage,
                        discountAmount: element.discountAmount,
                        taxPercentage: element.taxPercentage, // Single tax rate
                        taxId: element.taxId??undefined,
                        taxes: element.taxes,
                        taxType: element.taxType,
                        transactionDiscount: element.billDiscount,
                        discountIncludesTax: element.discountIncludesTax,
                        supplierCreditDiscount:0 
                    };
                   items.push(item)
                }
            }
        });




        const a = calculateBill(items, this.isInclusiveTax, this.discountAmount, this.discountPercentage, this.applyDiscountBeforeTax, afterDecimal);
        this.itemSubTotal= a.subtotal
        total = a.total
        this.discountTotal = a.discount
        this.billingTaxTotal = a.tax
        this.billDiscount = a.transactionDiscount
 
        this.lines.forEach(element => {
    const match = a.lines.find(nl => nl.id === element.id || nl.id === String(element.index));
    if(match){
         element.taxes = match.taxes??element.taxes
         element.taxTotal = match.taxTotal??element.taxTotal
         element.taxPercentage = match.taxPercentage??element.taxPercentage
         element.billDiscount = match.transactionDiscount??element.billDiscount
         element.taxableAmount = match.taxableAmount??element.taxableAmount

    }
 })       


        
        console.log(">>>>>>>>bill>>>>>>>>>>")
        console.log("bill subTotal:", a.subtotal, 
            "bill total:", a.total,  
            "\nbill discount:", a.discount,
            "\nbill tax:", a.tax,
         )
         console.log(">>>>>>>>end>>>>>>>>>>")



        


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

        this.total = Helper.add(total , this.shipping,afterDecimal);
        this.calculateRounding(afterDecimal);
        this.total = Helper.add(this.total,this.roundingTotal,afterDecimal)
 
        
    }

    

    setBalance() {
        this.appliedCredit += Number(this.refunded);
        const paidTotal = this.paidAmount + this.appliedCredit;
        const billBalance = this.total - Number(this.refunded);


        this.balance = this.total - (paidTotal)
         console.log(this.balance)
        // if (this.balance!= 0 && (this.status != "Draft" && this.balance == this.total && billBalance > 0)) {
        //     this.status = "Open"
        // } else {
        //     if  (this.refunded != this.total  && paidTotal > 0 && (billBalance != 0 ||         this.balance == 0) ) {
        //         if (paidTotal >0&&this.balance <= 0) {
        //             this.status = "Paid"
        //         } else if (paidTotal >0 &&this.balance < this.total) {
        //             this.status = "Partially Paid"
        //         }
        //     } else {

        //         this.status = "Closed"
        //         if (this.refunded == 0 || this.refunded == null) {
        //             this.status = "Open"

        //         }
        //     }



        // }
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
                    roundingTotal = Helper.multiply(Math.round(Helper.division(this.total , this.smallestCurrency,afterDecimal)) ,this.smallestCurrency,afterDecimal);
                    break;
                case "positive":

                    roundingTotal = Helper.multiply(Math.ceil(Helper.division(this.total , this.smallestCurrency,afterDecimal)) ,this.smallestCurrency,afterDecimal);
                    break;
                case "negative":
                    roundingTotal =  Helper.roundNum(Math.trunc(Helper.division(this.total , this.smallestCurrency,afterDecimal)),afterDecimal)
                    roundingTotal = Helper.multiply(roundingTotal , this.smallestCurrency,afterDecimal)
                    break;
                default:
                    break;
            }
    
           this.roundingTotal =  Helper.sub(roundingTotal, this.total, afterDecimal);
          
        }

        return 0;
    }

    resetTaxes(){
        this.lines.forEach(element => {
            element.taxId = null
            element.taxes = []
            element.taxPercentage = 0 
            element.taxes = []
            element.taxTotal = 0 
        });
    }
}