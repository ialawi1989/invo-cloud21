import { Helper } from "@src/utilts/helper";
import { SupplierRefundLine } from "./supplierRefundLine";

export class SupplierRefund {
    id = "";
    supplierCreditId="";
    employeeId="";
    companyId="";

    refundedDate = new Date();
    createdAt = new Date();
    reference = "";
    total = 0;

    paymentMode="";
    description="";
    lines:SupplierRefundLine[]=[];
    referenceNumber="";
    ParseJson(json: any): void {
        for (const key in json) {
            if(key == "lines")
            {
                const linesTemp: SupplierRefundLine[] = [];
                let lineTemp: SupplierRefundLine;
                json[key].forEach((line: any) => {
                    lineTemp = new SupplierRefundLine();
                    lineTemp.ParseJson(line);
                    linesTemp.push(lineTemp);
                })
                this.lines = linesTemp;
            }
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    calculateTotal(afterDecimal:number){
        this.total =0;
        this.lines.forEach(element => {
            this.total += Helper.roundNum(element.amount,afterDecimal)
        });
    }
}