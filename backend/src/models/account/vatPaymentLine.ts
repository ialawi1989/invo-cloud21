import { Helper } from "@src/utilts/helper";

export class VatPaymentLine {
    id: string | null;
    vatPaymentId = "";
    amount = 0
    paymentMethodId = "";
    paymentMethodAccountId = "";
    employeeId = "";
    paymentDate = new Date();
    reconciliationId = "";
    createdAt = new Date();
    referenceNumber = ''
    branchId="";
    afterDecimal = 3
    constructor() {
        this.id = ""
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    calculateTotal(){
       this.amount = Helper.roundDecimal(this.amount,this.afterDecimal)
    }
}