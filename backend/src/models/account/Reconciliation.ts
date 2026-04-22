import { Helper } from "@src/utilts/helper";

export class ReconciliationTransaction {
    id = ""
    reference = ""// expence or billing payment or invoice payment or refund ......
    reconcile = false;
    Debit = 0;
    Credit = 0;
    reconciliationId = '';
    createdAt = new Date();
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }


}

export class Reconciliation {
    id = "";
    from = new Date()
    to = new Date()
    closingBalance = 0
    employeeId = "";
    branchId: string | null;
    companyId = "";
    accountId = "";
    transactions: ReconciliationTransaction[] = []
    afterDecimal = 3;
    status = "";
    createdAt = new Date()
    attachment = [];
    reconciledAt: null | Date;
    total = 0;
    openingBalance = 0
    constructor() {
        this.branchId = null;
        this.reconciledAt = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'transactions') {
                const transactionsTemp: ReconciliationTransaction[] = [];
                let transaction: ReconciliationTransaction;
                json[key].forEach((line: any) => {
                    transaction = new ReconciliationTransaction();
                    transaction.ParseJson(line);
                    transactionsTemp.push(transaction);
                })
                this.transactions = transactionsTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }

            }
        }
    }

    get debitTotal() {
        let total = 0;
        this.transactions.forEach(element => {
            if (element.reconcile) {
                total = Helper.add(total, Helper.roundDecimal(Math.abs(element.Debit), this.afterDecimal), this.afterDecimal);
                // total += Helper.roundNum(Math.abs(element.Debit), this.afterDecimal)
            }
        });
        return total
    }

    get creditTotal() {
        let total = 0;
        this.transactions.forEach(element => {
            if (element.reconcile) {
                total = Helper.add(total, Helper.roundDecimal(Math.abs(element.Credit), this.afterDecimal), this.afterDecimal);
                // total += Helper.roundNum(Math.abs(element.Credit), this.afterDecimal)
            }
        });
        return total
    }
    calculateTotal(afterDecimal: number) {
        try {
            let currentTotal = 0;
            this.afterDecimal = afterDecimal;
            // let totalDebit = Helper.add(this.debitTotal , this.openingBalance,afterDecimal)
            currentTotal = Helper.roundDecimal(Helper.sub(this.debitTotal + (+Number(this.openingBalance)), this.creditTotal, afterDecimal),afterDecimal)
            this.total = Helper.sub(this.debitTotal, this.creditTotal, afterDecimal);
             
            console.log(this.debitTotal,  this.creditTotal ,this.openingBalance,currentTotal,this.closingBalance)
            if (currentTotal != this.closingBalance && this.status == 'reconciled') {
                throw new Error("The Concilied amount is less than closing Balance DebitTotal: " + this.debitTotal + " CreditTotal: " + this.creditTotal + " OB: " + this.openingBalance);
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
}