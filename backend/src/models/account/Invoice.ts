import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { Helper } from "@src/utilts/helper";
import { Customer } from "./Customer";
import { InvoiceLine, TaxModel } from "./InvoiceLine";

import { InvoicePayment } from "./InvoicePayment";
import { InvoicePaymentLine } from "./InvoicePaymentLine";
import { Log } from "../log";
import moment from "moment";
import { TimeHelper } from "@src/utilts/timeHelper";
import { any } from "bluebird";


export class TaxDetails {

    taxId = ""
    type = ""
    taxPercentage = 0
    taxAmount = 0
    taxes = []
    taxName = ""
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {

                this[key as keyof typeof this] = json[key];


            }
        }
    }

}
export class Invoice {
    id = "";
    employeeId: string | null;
    tableId: string | null;
    mergeWith: string | null;
    terminalId: string | null;
    branchId = "";
    serviceId: string | null;
    driverId: string | null;
    invoiceNumber: string | null;
    refrenceNumber = "";
    note = "";
    guests = 0;
    customerSignature: string | null = null;
    pointsDiscount: number | null = null;
    promoCoupon: number | null = null;
    couponId: string | null = null;   
 
    chargeId: string | null;
    chargeAmount = 0;
    chargePercentage = false
    chargeTotal = 0;
    deliveryCharge = 0;

    discountId: string | null;
    discountAmount = 0;
    discountPercentage = false
    discountTotal = 0;

    estimateSource = "";
    source = "Cloud"; //POS, ONLINE ...
    customerId: string | null;
    customerContact = "";
    customerAddress: any | null = {};

    customerLatLang: any = {
    }



    estimateId: string | null;

    status = "Open"; //T


    printTime: Date | null;
    readyTime: Date | null;
    departureTime: Date | null;
    arrivalTime: Date | null;
    scheduleTime: Date | null;


    subTotal = 0;
    total = 0;
    paidAmount = 0;
    balance = 0; // total - paid 
    refunded = 0;// credit not total linked to this invoice 
    appliedCredit = 0;// amount applied on this invoice from credit notes 


    customer = new Customer();
    employee: any | null = null
    driver: any | null = null
    service: any | null = null

    table: any | null;
    lines: InvoiceLine[] = [];
    invoicePayments: InvoicePayment[] = [];

    employeeName = "";
    branchName = "";
    customerName = "";
    driverName = "";

    smallestCurrency = 0;
    roundingType = "normal";
    roundingTotal = 0;

    invoiceDate = new Date();
    createdAt: Date = new Date();
    updatedDate = new Date()

    isInclusiveTax = false;




    serviceName: string | null;
    tableName: string | null;


    itemSubTotal = 0

    invoiceTaxTotal = 0;
    //TODO:ADD TO INVOICE Table 
    houseAccount = false;
    onlineStatus = "";
    rejectReason = "";

    onlineData: any = {};
    grubTechData: any = {}

    customerVatNumber = ""
    companyVatNumber = ""
    currentInvoiceStatus = "" // to check if invoice online status is being changed from pending to accpeted

    minimumOrder = 0;


    isPaid = false;
    //TODO: drop this from db 
    mediaId: string | null;
    mediaUrl = ""
    addressKey = "";


    writeOffDate: null | Date;

    attachment = [];



    onlineActionTime: null | Date; /**When Online Invoice got rejeted/accepted */
    dueDate: Date | null;
    logs: Log[] = [];

    mergeWithInvoiceNumber = ""
    branchAddress = "";
    branchPhone = ""
    branchCustomFields: any[] = [];
    customerEmail = ""

    //TODO:
    salesEmployeeId: string | null;/** case when lines has no sales employee id consider comission on employeeSalesId on invoice */
    salesEmployeeName = ""

    discountType = "";/** an indecator to differenciate old invoices from new invoices after changes made in discount (before discount can be applied after tax)  */
    customerPhone = "";

    aggregator = "";
    aggregatorId: string | null = null;

    recurringInvoiceId: string | null = null;

    paymentTerm: "net7" | "net10" | "net15" | "net30" | "net60" | "net90" | "custome" | "endOfTheMonth" | "onReceiptDue";
    receivableAccountId: string | null;
    oldReadyTime: string | null;

    chargesTaxDetails: TaxDetails | null;
    chargeType = "chargeBeforeTax";

    taxesDetails: any[] = [];

    itemDiscountTotal = 0
    customFields: any[] = [];
    externalId: string = "";

    appliedCreditTotal = 0
    creditNoteTotal = 0
    paymentTotal = 0
    refundTotal = 0
    subscriptionId: string | null;
    shopperId: string | null;
    companyId = ""
    cartHash: string | null = null
    countryCode: string | null = null

    toPaidAmount = 0;
    freeDeliveryOver: number | null = null;
    tempDeliveryCharge: number | null = null;
    shippingOptions:any|null= null;
    oldTableId: string | null = null;
    deliveryNote:string|null = null ;
    applePayTokendata:any|null = null 
    tableGroupName:string|null = null;
    constructor() {
        this.shopperId = null
        this.oldReadyTime = null
        this.subscriptionId = null
        this.employeeId = null;
        this.chargesTaxDetails = null;
        this.recurringInvoiceId = null
        this.terminalId = null;
        this.tableId = null;
        this.serviceId = null;
        this.customerId = null;
        this.estimateId = null;
        this.printTime = null;
        this.readyTime = null;
        this.departureTime = null;
        this.arrivalTime = null;
        this.discountId = null;
        this.chargeId = null;
        this.scheduleTime = null;
        this.mergeWith = null;
        this.driverId = null;
        this.onlineActionTime = null;
        this.writeOffDate = null;
        this.serviceName = null;
        this.tableName = null
        this.invoiceNumber = null;
        this.onlineData.sessionId = "";
        this.onlineData.onlineStatus = "";
        this.mediaId = null;

        this.salesEmployeeId = null
        this.aggregatorId = null
        this.paymentTerm = "custome"
        this.dueDate = null;
        this.receivableAccountId = null;

    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "lines") {
                const linesTemp: InvoiceLine[] = [];
                let invoiceLine: InvoiceLine;
                json[key].forEach((line: any) => {


                    invoiceLine = new InvoiceLine();
                    invoiceLine.ParseJson(line);

                    linesTemp.push(invoiceLine);

                });
                this.lines = linesTemp;

            } else if (key == "employeeId" && json[key] == "") {
                this[key] = null;
            } else if (key == "mediaId" && json[key] == "") {
                this[key] = null;
            } else if (key == 'chargesTaxDetails' && json[key] != "" && json[key] != null) {
                let temp = new TaxDetails()
                let opject = Helper.checkAndParseArrayOpjects(json[key])
                temp.ParseJson(opject)
                this.chargesTaxDetails = temp
            } else if (key == 'attachment' && json[key] == 'null') {
                this.attachment = []
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
        this.dueDate = this.dueDateFromTerm()
    }

    itemTotal(afterDecimal: number): number {
        let price = 0;
        let subTotal = 0;
        let taxTotal = 0;
        this.itemDiscountTotal = 0
        this.lines.forEach(element => {

            element.isInclusiveTax = this.isInclusiveTax;

            element.calculateTotal(afterDecimal);

            price = element.voidedItems && element.voidedItems.length == 0 && element.isVoided ? Helper.add(price, 0) : Helper.add(price, Helper.roundNum(element.total, afterDecimal), afterDecimal);
            subTotal += Helper.sub(element.subTotal, element.discountTotal, afterDecimal);
            taxTotal += element.taxTotal
            this.itemDiscountTotal += element.discountTotal;
            element.voidedItems.forEach(voided => {
                voided.isInclusiveTax = this.isInclusiveTax;
                voided.calculateTotal(afterDecimal);
                taxTotal += voided.taxTotal
                price = Helper.add(price, Helper.roundNum(voided.total, afterDecimal), afterDecimal)
                const vodiedSubTotal = Helper.add(voided.subTotal ,voided.discountTotal * (-1) ,afterDecimal);
                subTotal = Helper.add(subTotal,vodiedSubTotal, afterDecimal);
                this.itemDiscountTotal += voided.discountTotal;
            });


        });
        this.invoiceTaxTotal = taxTotal
        this.itemSubTotal = subTotal;
        return price;

    }

    dueDateFromTerm(): Date | null {
        switch (this.paymentTerm) {
            case 'net7':
                this.dueDate = new Date(moment(this.invoiceDate).add(7, 'day').format())
                break;
            case 'net10':
                this.dueDate = new Date(moment(this.invoiceDate).add(10, 'day').format())
                break;
            case 'net15':
                this.dueDate = new Date(moment(this.invoiceDate).add(15, 'day').format())
                break;
            case 'net30':
                this.dueDate = new Date(moment(this.invoiceDate).add(30, 'day').format())
                break;
            case 'net60':
                this.dueDate = new Date(moment(this.invoiceDate).add(60, 'day').format())
                break;
            case 'net90':
                this.dueDate = new Date(moment(this.invoiceDate).add(90, 'day').format())
                break;
            case 'onReceiptDue':
                this.dueDate = new Date(moment(this.invoiceDate).endOf('day').format())
                break;
            case 'endOfTheMonth':
                this.dueDate = new Date(moment(this.invoiceDate).endOf('month').format())
                break;
            case 'custome':
                this.dueDate = this.dueDate
                break;
            default:
                this.dueDate = new Date(moment(this.invoiceDate).endOf('day').format())
                break;
        }
        return this.dueDate;

    }

    get invoiceDiscount(): number {
        if (this.discountType == "itemDiscount") return 0;
        if (this.discountPercentage) {
            return this.subTotal * (this.discountAmount / 100);
        } else {
            if (this.subTotal <= 0) {
                this.discountAmount = 0;
            }
            return this.discountAmount;
        }
    }

    calculateTotal(afterDecimal: number) {
        this.subTotal = this.itemTotal(afterDecimal);
        this.total = this.subTotal;


        if (this.discountAmount > 0) {
            this.discountTotal = this.invoiceDiscount
            this.total = Helper.sub(this.total, this.discountTotal, afterDecimal);
        }



        // this.chargeTotal = this.chargeAmount;
        if (this.chargeAmount > 0) {
            if (this.chargePercentage) {
                let totalForCharge = this.chargeType == 'chargeBeforeTax' && this.isInclusiveTax ? Helper.sub(this.total, this.invoiceTaxTotal, afterDecimal) : Helper.roundNum(this.itemSubTotal, afterDecimal)
                this.chargeTotal = Helper.multiply(totalForCharge, Helper.division(this.chargeAmount, 100, afterDecimal), afterDecimal);
            } else {
                if (this.total == 0) {
                    this.chargeAmount = 0
                } else {
                    this.chargeTotal = this.chargeAmount
                }
            }

            this.total = Helper.add(this.total, this.chargeTotal, afterDecimal);
        }
        if (this.total == 0 && (this.lines.length > 0 || this.mergeWith)) {
            this.deliveryCharge = 0
        }


        if (this.chargesTaxDetails && this.chargeId != null && this.chargeId != "" && this.chargeTotal > 0 && this.chargeType == 'chargeBeforeTax') {

            this.calculateChargeTax(afterDecimal, this.chargeTotal);
            this.invoiceTaxTotal = Helper.add(this.invoiceTaxTotal, this.chargesTaxDetails.taxAmount, afterDecimal)
            if (!this.isInclusiveTax) {
                this.total = Helper.add(this.total, this.chargesTaxDetails.taxAmount, afterDecimal)
            }
        } else {
            // this.chargeTotal = 0 
            this.chargesTaxDetails = null

        }

        if (this.deliveryCharge > 0) {
            this.tempDeliveryCharge = this.deliveryCharge;
        }

        if (this.freeDeliveryOver && this.freeDeliveryOver > 0) {
            if (this.total >= this.freeDeliveryOver) {
                this.deliveryCharge = 0
            } else if (this.tempDeliveryCharge && this.tempDeliveryCharge > 0) {
                this.deliveryCharge = this.tempDeliveryCharge
            }
        }
        this.total = Helper.add(this.total,  this.deliveryCharge,  afterDecimal);



        //      if(this.pointsDiscount && this.pointsDiscount >0)
        //  {
        //     this.total = Helper.sub(this.total,this.pointsDiscount,afterDecimal)
        //  }
        this.calculateRounding(this.total, afterDecimal);

        this.total = Helper.add(this.total, this.roundingTotal, afterDecimal)


        if (this.total < 0) {
            this.total = 0;
        }

        if (this.mergeWith != '' && this.mergeWith != null) {
            this.roundingTotal = 0
        }

    }


    calaculateBalance() {

        // const invoiceBalance = this.total - (parseFloat(this.appliedCredit.toString()) + parseFloat(this.paidAmount.toString()))
        // this.balance = invoiceBalance
        // // this.status = this.status == "" ? "Open" : this.status
        // let paymentTotal = (Number(this.appliedCredit) + this.paidAmount);

        // this.balance = this.balance < 0 ? 0 : this.balance;
        this.appliedCredit = this.creditNoteTotal + this.appliedCreditTotal
        this.paidAmount = this.paymentTotal

        let totalPaid = Helper.add(this.appliedCredit, this.paidAmount)


        this.balance = Helper.add(Helper.sub(this.total, Helper.add(totalPaid, this.creditNoteTotal)) , this.refundTotal)


        // if(this.mergeWith != null && this.mergeWith!="")
        // {
        //     this.status = "merged"
        //     return;
        // }
        // if(this.status == "writeOff"  ){
        //     return;
        // }
        // if (this.status != "writeOff" && this.status != "Draft") {
        //     if ((this.balance == this.total && invoiceBalance > 0) && ( this.onlineData && this.onlineData.onlineStatus != "Rejected") && this.mergeWith ==null ) {
        //         this.status = "Open"
        //         return
        //     } else {
        //         let allLinesVoided = false;
        //         for (let index = 0; index < this.lines.length; index++) {
        //             const element = this.lines[index];
        //             if (element.remainQty == 0) {
        //                 allLinesVoided = true;
        //             } else {
        //                 allLinesVoided = false;
        //                 break;
        //             }
        //         }

        //         if (allLinesVoided) {
        //             this.status = "Void"
        //             return 
        //         } else {
        //             if ( ((this.total - this.refunded) == 0 && this.refunded>0) || (this.onlineData && this.onlineData.onlineStatus == "Rejected") || this.mergeWith !=null) {
        //                 this.status = "Closed"
        //             } else if (paymentTotal>0) {
        //                 if (this.balance <= 0 ) {
        //                     this.status = "Paid"

        //                 } else if (this.paidAmount > 0 && this.balance > 0 && this.balance < this.total) {
        //                     this.status = "Partially Paid"
        //                 }
        //             }
        //         }
        //         // }
        //     }
        // }
    }
    calculateRounding(total: number, afterDecimal: number) {
        if (this.id == "" || this.id == null) {

            if (this.smallestCurrency == 0 || this.smallestCurrency == null || this.smallestCurrency == undefined) {

                this.smallestCurrency = Helper.division(1, Helper.roundNum((Math.pow(10, parseInt(afterDecimal.toString()))), afterDecimal), afterDecimal)
                this.roundingType = 'normal'
            }

        }


        if (this.smallestCurrency > 0) {
            let roundingTotal = 0;
            switch (this.roundingType) {
                case "normal":
                    roundingTotal = Helper.multiply(Math.round(Helper.division(total, this.smallestCurrency, afterDecimal)), this.smallestCurrency, afterDecimal);
                    break;
                case "positive":

                    roundingTotal = Helper.multiply(Math.ceil(Helper.division(total, this.smallestCurrency, afterDecimal)), this.smallestCurrency, afterDecimal);
                    break;
                case "negative":
                    roundingTotal = Helper.roundNum(Math.trunc(Helper.division(total, this.smallestCurrency, afterDecimal)), afterDecimal)
                    roundingTotal = Helper.multiply(roundingTotal, this.smallestCurrency, afterDecimal)
                    break;
                default:
                    break;
            }

            this.roundingTotal = Helper.sub(roundingTotal, total, afterDecimal);


        }

        return 0;
    }

    removeItem(transactionId: string) {
        let line: any = this.lines.find((f: any) => f.id == transactionId)
        this.lines.splice(this.lines.indexOf(line), 1)
    }

    resetInvoice() {

        this.total = 0;
        this.subTotal = 0;
        this.balance = 0;

        this.chargeId = null;
        this.chargeAmount = 0;
        this.branchName = "";
        this.customer = new Customer()
        this.customerId = "";
        this.customerAddress = "";
        this.customerContact = "";
        this.customerLatLang = "";
        this.customerName = "";
        this.deliveryCharge = 0;
        this.discountId = null;
        this.discountTotal = 0;
        this.discountAmount = 0;
        this.lines = [];
    }
    //TODO: 
    /**
     * 
     * status
PENDING
Accepted
readyTime
Departure 
Arriaval 

     */
    setOnlineStatus() {
        if (this.readyTime != null) { /** ready to pickUp */
            this.onlineData.onlineStatus = "Ready"
        }

        if (this.departureTime != null) {
            this.onlineData.onlineStatus = "Departure"
        }

        if (this.arrivalTime != null) {
            this.onlineData.onlineStatus = "Arrived"
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
        this.logs = Helper.checkAndParseArrayOpjects(this.logs)
        this.parsePosLogs()
        let mergedArray = this.logs.concat(logs);

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

        return Helper.roundNum(total, afterDecimal)
    }

    calculateChargeTax(afterDecimal: number, chargeTotal: number) {
        //If the tax applied is Group Tax 
        if (this.chargesTaxDetails) {
            if (this.chargesTaxDetails.taxes && Array.isArray(this.chargesTaxDetails.taxes) && this.chargesTaxDetails.taxes.length > 0 && this.chargesTaxDetails.type != "") {

                let total = chargeTotal; // qty*price
                let taxTotal = 0;
                let taxTotalPercentage = 0;


                const taxesTemp: any = []
                if (this.isInclusiveTax && this.chargesTaxDetails.taxes.length > 0 && (this.chargesTaxDetails.type == "flat" || this.chargesTaxDetails.type == "stacked")) {
                    total = this.getBasePrice(total, this.chargesTaxDetails.taxes, afterDecimal, this.chargesTaxDetails.type)
                }
                if (this.isInclusiveTax && this.chargesTaxDetails.taxes.length > 0 && (this.chargesTaxDetails.type == "flat" || this.chargesTaxDetails.type == "stacked")) {
                    total = this.getBasePrice(total, this.chargesTaxDetails.taxes, afterDecimal, this.chargesTaxDetails.type)
                }
                if (this.chargesTaxDetails.type == "flat") { // flat tax calculate both tax separately from line total 
                    this.chargesTaxDetails.taxes.forEach((tax: any) => {
                        const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                        taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal);
                        taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal);
                        tax.taxAmount = Helper.roundNum(taxAmount, afterDecimal)
                        taxesTemp.push(tax)
                    });
                } else if (this.chargesTaxDetails.type == "stacked") {// stacked tax both tax depened on each other 
                    this.chargesTaxDetails.taxes.forEach((tax: any) => {
                        const taxAmount = Helper.multiply(total, Helper.division(tax.taxPercentage, 100, afterDecimal), afterDecimal)
                        taxTotalPercentage = Helper.add(taxTotalPercentage, tax.taxPercentage, afterDecimal)
                        taxTotal = Helper.add(taxTotal, taxAmount, afterDecimal)
                        total = Helper.add(total, taxAmount, afterDecimal);

                        tax.taxAmount = Helper.roundNum(taxAmount, afterDecimal)
                        taxesTemp.push(tax)
                    });
                }
                this.chargesTaxDetails.taxPercentage = taxTotalPercentage;
                this.chargesTaxDetails.taxAmount = taxTotal;
                this.chargesTaxDetails.taxes = taxesTemp;
            } else {

                this.chargesTaxDetails.taxAmount = this.isInclusiveTax ? Helper.division(Helper.multiply(chargeTotal, this.chargesTaxDetails.taxPercentage, afterDecimal), Helper.add(100, this.chargesTaxDetails.taxPercentage, afterDecimal), afterDecimal) : Helper.multiply(chargeTotal, Helper.division(this.chargesTaxDetails.taxPercentage, 100, afterDecimal), afterDecimal);
            }

        }

    }



    setTaxesDetails() {
        try {
            this.lines.map((f) => {


                if (f.taxes && f.taxes.length == 0 || !f.taxes) {
                    let tax = this.taxesDetails.find((item: any) => item.taxId == f.taxId)


                    if (tax) {
                        let index = this.taxesDetails.indexOf(tax)
                        this.taxesDetails[index].total += f.taxTotal

                    } else {
                        this.taxesDetails.push({ taxId: f.taxId, taxName: f.taxName ?? f.taxPercentage + ' %', total: f.taxTotal, taxPercentage: f.taxPercentage })
                    }

                }


                if (f.taxes && f.taxes.length > 0) {
                    f.taxes.map((subTaxes: any) => {
                        let tax = this.taxesDetails.find((item: any) => item.taxId == subTaxes.taxId)


                        if (tax) {
                            let index = this.taxesDetails.indexOf(tax)
                            this.taxesDetails[index].total += subTaxes.taxAmount

                        } else {

                            this.taxesDetails.push({ taxId: subTaxes.taxId, taxName: subTaxes.taxName ?? subTaxes.taxPercentage + ' %', total: subTaxes.taxAmount, taxPercentage: subTaxes.taxPercentage })
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
                        this.taxesDetails.push({ taxId: this.chargesTaxDetails.taxId, taxName: this.chargesTaxDetails.taxName ?? this.chargesTaxDetails.taxPercentage + ' %', total: this.chargesTaxDetails.taxAmount, taxPercentage: this.chargesTaxDetails.taxPercentage })
                    }
                }



                if (this.chargesTaxDetails.taxes && this.chargesTaxDetails.taxes.length > 0) {
                    this.chargesTaxDetails.taxes.map((subTaxes: any) => {
                        let tax = this.taxesDetails.find((item: any) => item.taxId == subTaxes.taxId)


                        if (tax) {
                            let index = this.taxesDetails.indexOf(tax)
                            this.taxesDetails[index].total += subTaxes.taxAmount

                        } else {

                            this.taxesDetails.push({ taxId: subTaxes.taxId, taxName: subTaxes.taxName ?? subTaxes.taxPercentage + ' %', total: subTaxes.taxAmount, taxPercentage: subTaxes.taxPercentage })
                        }

                    })
                }
            }
        } catch (error) {
            console.log(error)
        }
    }


    createNewCart() {
        this.id = "";
        this.onlineData.onlineStatus = 'Placed'
        this.createdAt = new Date()
        this.invoiceDate = new Date()
        const linesTemp: InvoiceLine[] = [];
        this.lines.forEach(el => {
            el.createdAt = new Date();
            linesTemp.push(el)
        })
        this.lines = linesTemp
    }

}