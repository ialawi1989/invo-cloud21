import { Helper } from "@src/utilts/helper";
import { ExpenseLine } from "./expenseLine";
import { Log } from "../log";

export class Expense {
    id = "";
    branchId = "";
    employeeId = "";
    supplierId: string | null;
    customerId: string | null;
    recurringExpenseId: string | null;
    paymentMethodId = "";
    paidThroughAccountId = "";

    referenceNumber = "";
    expenseNumber = "";



    expenseDate = new Date();
    createdAt = new Date();

    total = 0;

    lines: ExpenseLine[] = []
    isInclusiveTax = false;

    attachment = [];

    employeeName = "";
    branchName = "";
    supplierName = "";
    customerName = "";
    paymentMethodName = ""
    logs: Log[] = []

    reconciled = false;
    smallestCurrency = 0;
    roundingType = "";
    roundingTotal = 0;
    branchCustomFields:any=null
    companyId = ""
    note = ""
    constructor() {
        this.supplierId = null;
        this.customerId = null;
        this.recurringExpenseId = null;
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "lines") {
                const linesTemp: ExpenseLine[] = [];
                let expenseLine: ExpenseLine;
                json[key].forEach((line: any) => {
                    expenseLine = new ExpenseLine();
                    expenseLine.ParseJson(line);
                    linesTemp.push(expenseLine);
                });
                this.lines = linesTemp;
            } else {
                if (key in this) {

                    this[key as keyof typeof this] = json[key];
                }
            }

        }
    }


    calculateTotal(afterDecimal: number) {
        this.total = 0;
        this.lines.forEach(element => {
            element.isInclusiveTax = this.isInclusiveTax;
            element.calculatetotal(afterDecimal);
            this.total = Helper.add(this.total, element.total, afterDecimal);
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