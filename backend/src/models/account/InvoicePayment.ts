import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { Helper } from "@src/utilts/helper";
import { InvoicePaymentLine } from "./InvoicePaymentLine";
import { Log } from "../log";
import { TimeHelper } from "@src/utilts/timeHelper";

export class InvoicePayment {
    /**
     * 
     * tenderAmount : is handed over money total amount paid
     * 
     * paidAmount: is total used amount from the tendered amount
     */

    id = "";
    branchId = "";

    tenderAmount = 0;
    createdAt = new Date();

    paymentMethodId = "";
    employeeId: string | null;
    cashierId: string | null;
    paymentMethodAccountId: string | null = "";
    accountId = "";
    paidAmount = 0;
    customerId: string | null;

    paymentDate = new Date();
    updatedDate = new Date();
    lines: InvoicePaymentLine[] = []

    rate = 1;
    //TODO: ADD IT TO DB PRODUCTIONS AND TESTING AND SATGING
    status = "SUCCESS" //FAIL , PENDING
    referenceId: string | null;
    onlineData: any | null;


    referenceNumber = "";

    mediaId: string | null;
    mediaUrl = "";



    paymentMethodType = "";
    attachment: [] = [];

    bankCharge = 0;
    bankChargePercentage = 0;


    changeAmount: number | null = null  /** tenderAmount - paidAmount (remaining)  when greater than zero then there is a returned amount */
    /**In Journal tenderAmount - (paidAmoint+changeAmount) if = 0 then no customer Credit ONLY FROM "POS"*/

    employeeName = "";
    branchName = "";
    branchAddress = "";
    branchPhone = "";

    logs: Log[] = [];
    customerContact = ""
    reconciled = false;
    deviceId: string | null;

    customerName = ""

    paymentMethodName = "";
    accountName = "";
    customerEmail = "";
    source = "Cloud"
    constructor() {
        this.cashierId = null
        this.customerId = null
        this.referenceId = null
        this.onlineData = null
        this.employeeId = null
        this.mediaId = null
        this.deviceId = null
    }
    allBranches = false
    companyId = "";
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'lines') {
                const linesTemp: InvoicePaymentLine[] = [];
                let paymentLine: InvoicePaymentLine;
                json[key].forEach((line: any) => {
                    paymentLine = new InvoicePaymentLine();
                    paymentLine.ParseJson(line);
                    linesTemp.push(paymentLine)
                })
                this.lines = linesTemp;
            } else {
                if (key in this) { this[key as keyof typeof this] = json[key]; }

            }

        }
    }
    //TODO: BANK CHARGE MOBE TO INVOICE Payment and referenceNumber "POS" TOO

    checkPaymentDate() {
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0)
        const newDate = new Date(this.createdAt)
        newDate.setHours(0, 0, 0, 0)

        if (currentDate < newDate) {
            return false
        }
        return true
    }

    get linesTotal() {
        let total = 0;
        this.lines.forEach(element => {
            total += element.amount
        });

        return total
    }

    get totalPaidAmount() {
        return this.tenderAmount * this.rate;
    }

    calculateTotal(afterDecimal: number) {

        this.paidAmount = 0;
        this.lines.forEach(element => {

            // element.calculateToTal(afterDecimal)
            this.paidAmount = Helper.addWithRounding(this.paidAmount, element.amount, afterDecimal)


        });
        console.log(+Number(this.tenderAmount) == 0, this.paidAmount)
        this.tenderAmount = +Number(this.tenderAmount) == 0 ? this.paidAmount : this.tenderAmount

        //   if(this.paymentMethodType =="Card")
        //   {
        //       this.bankChargePercentage = Helper.multiply(this.paidAmount,this.bankCharge,afterDecimal)
        //       console.log(this.bankChargePercentage)

        //   }

        if (this.changeAmount != 0 && this.rate != 1) {
            // this.calculateChangeAmount(afterDecimal)
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

                this.logs = logs
            }

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


    // calculateChangeAmount(afterDecimal:number) {

    //     let total = Helper.multiply( this.tenderAmount , this.rate,afterDecimal) 
    //     let difference = Helper.sub(total ,this.paidAmount,afterDecimal) 
    //     this.changeAmount = Helper.division(difference ,this.rate,afterDecimal) 
    //     console.log("changeeee",this.changeAmount)
    // }
}