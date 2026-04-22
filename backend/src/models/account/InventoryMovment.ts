import { Helper } from "@src/utilts/helper";
import { InventoryMovmentLine } from "./InventoryMovmentLine";

export class InventoryMovment {
    id = "";
    createdAt = new Date();
    branchId = "";
    invoiceLineId: string | null;
    invoiceId:string|null;
    physicalCountLineId: string | null;
    inventoryMovmentDate = new Date();
    inventoryTransferLineId: string | null;
    creditNoteLineId: string | null;
    billingLineId: string | null;
    supplierCreditLineId: string | null;
    employeeId="";
    referenceId = "";
    adjustmentType : string |null  = null
    cost = 0; // Cost Of Goods  Sold
    lines: InventoryMovmentLine[] = []
      type ="Manual Adjusment"

      branchName =""
    constructor() {
        this.invoiceId = null;
        this.invoiceLineId = null;
        this.physicalCountLineId = null;
        this.inventoryTransferLineId = null;
        this.creditNoteLineId = null
        this.billingLineId = null;
        this.supplierCreditLineId = null;

    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'lines') {
                const linesTemp: InventoryMovmentLine[] = [];
                let movmentLine: InventoryMovmentLine;
                json[key].forEach((line: any) => {
                    movmentLine = new InventoryMovmentLine();
                    movmentLine.ParseJson(line);
                    linesTemp.push(movmentLine);
                })
                this.lines = linesTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }

            }
        }
    }

    set lineId(referenceTable: string) {
        switch (referenceTable) {
            case "Invoice":
                this.invoiceLineId = this.referenceId;
                break;
            case "CreditNote":
                this.creditNoteLineId = this.referenceId;
                break;
            case "PhysicalCount":
                this.physicalCountLineId = this.referenceId;
                break;
            case "InventoryTransfer":
                this.inventoryTransferLineId = this.referenceId;
                break;
            case "Billing":
                this.billingLineId = this.referenceId;
                break;
            case "SupplierCredit":
                this.supplierCreditLineId = this.referenceId;
                break;
            default:
                break;
        }
    }

    calculateTotal(afterDecimal:number){
        let total = 0
        this.lines.forEach(element => {
            if(!element.isDeleted){
           if(element.qty<0)
            {
                total+= Helper.multiply(element.qty,element.cost,afterDecimal)
            }else{
                total+= (Helper.multiply(element.qty,element.cost,afterDecimal) *-1)
            }}
        });

        this.cost = total
    }
}