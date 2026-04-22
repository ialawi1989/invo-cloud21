import { InvoiceLineOption } from "./invoiceLineOption";

export class CreditNoteLineOption{
    id="";
    optionId:string|null;
    note:string|null;
    price=0
    qty=0

    creditNoteLineId=""
    recipe:any []=[];
    invoiceOption:InvoiceLineOption|null = null;
    constructor(){
        this.optionId = null;
        this.note = null; 
    }
    ParseJson(json: any): void {
        for (const key in json) {
        
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}