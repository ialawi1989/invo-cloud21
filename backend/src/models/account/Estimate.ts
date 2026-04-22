import { Helper } from "@src/utilts/helper";
import { EstimateLine } from "./EstimateLine";
import { Customer } from "./Customer";

export class Estimate {
    id = "";
    employeeId = "";
    companyId = "";
    branchId = "";
    customerId: string | null;
    tableId: string | null;

    estimateNumber = "";
    refrenceNumber = "";
    note = "";
    guests = 0;

    chargeId: string | null;
    chargeAmount = 0;
    chargePercentage = false
    chargeTotal = 0;

    deliveryCharge = 0;

    discountId: string | null;
    discountAmount = 0;
    discountPercentage = false
    discountTotal = 0;


    subTotal = 0;
    total = 0;


    lines: EstimateLine[] = [];
    source = "Cloud";
    customerContact = "";
    createdAt = new Date();
    isInvoice = false; //indecator if the estimate is converted to invoice or not 
    updatedDate = new Date();
    estimateDate = new Date()
    estimateExpDate: Date | null;
    isInclusiveTax = false;

    //TODO : ADD IT TO ESTIMATE TABLE 
    serviceId: string | null;
    itemSubTotal = 0;

    serviceName: string | null;

    onlineData: any = {};
    estimateTaxTotal = 0;
    customerName = '';
    companyVatNumber = "";
    customerVatNumber = ""
    invoiceId = "";
    invoiceNumber = "";
    branchAddress = "";
    branchName = "";
    customer = new Customer();
    salesEmployeeId : string|null;

    branchPhone = ""
    employeeName = ""
    salesEmployeeName = ""

    discountType = "";/** an indecator to differenciate old invoices from new invoices after changes made in discount (before discount can be applied after tax)  */

    logs: [] = [];
    onlineStatus = ""
    rejectReason = "";
    smallestCurrency = 0
    roundingTotal = 0
    roundingType = ""
    attachment:any[] = [];
   branchCustomFields:any=null
    customerEmail= "";
    customFields:any|null  = null 
    constructor() {
        this.tableId = null;
        this.chargeId = null
        this.discountId = null;
        this.serviceId = null;
        this.serviceName = null;
        this.estimateExpDate = null;
        this.customerId = null;
        this.onlineData.sessionId = "";
        this.salesEmployeeId = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "lines") {
                const linesTemp: EstimateLine[] = [];
                let estimateLine: EstimateLine;
                json[key].forEach((line: any) => {
                    estimateLine = new EstimateLine();
                    estimateLine.ParseJson(line);
                    linesTemp.push(estimateLine);
                });
                this.lines = linesTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }
    afterDecimal = 3;
    itemTotal(afterDecimal: number): number {
        let price = 0;
        let subTotal = 0;
        let taxTotal = 0;
        this.lines.forEach(element => {
            if (!element.isVoided) {
                element.calculateTotal(afterDecimal)

                subTotal = Helper.add(subTotal, Helper.sub(element.subTotal, element.discountTotal, afterDecimal), afterDecimal);
                taxTotal = Helper.add(taxTotal, element.taxTotal, afterDecimal);
                if (!element.isVoided) {
                    price = Helper.add(price, element.total, afterDecimal);
                }

            }


        });
        this.itemSubTotal = subTotal;
        this.estimateTaxTotal = taxTotal;
        return price;
    }

    get discountEstimate(): number {
        if (this.discountType == "itemDiscount") return 0;

        if (this.discountPercentage) {
            return Helper.multiply(this.subTotal, Helper.division(this.discountAmount, 100, this.afterDecimal), this.afterDecimal);
        } else {
            return this.discountAmount;
        }
    }

    calculateTotal(afterDecimal: number) {
        this.subTotal = this.itemTotal(afterDecimal);
        this.total = this.subTotal
        this.afterDecimal = afterDecimal;
        if (this.discountAmount > 0) {

            this.discountTotal = this.discountEstimate
        }
        this.total = Helper.sub(this.total,this.discountTotal,afterDecimal);
        if (this.chargeAmount > 0) {
            if (this.chargePercentage) {
                this.chargeTotal = Helper.multiply(this.total, Helper.division(this.chargeAmount ,100,afterDecimal), afterDecimal)
            }
            this.total = Helper.add(this.total,this.chargeTotal,afterDecimal);
        }

        this.total = Helper.add(this.total,this.deliveryCharge,afterDecimal);
        this.total = Helper.roundNum(this.total, afterDecimal)
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
}