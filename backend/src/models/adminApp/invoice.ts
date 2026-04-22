// import { Role }   from './Role';
export class Invoice {
    constructor() {
    }
    id: number | null = null;
    createdAt: Date = new Date();
    companyId: string = "";
    companyName: string = "";
    startFrom: Date = new Date();
    periodId: string = "";
    periodName: String = "" ;
    Lines: InvoiceLines[] = [];

    itemsTotal = 0
    discount = 0
    subTotal = 0;
    tax = 0;
    total = 0;
    note = "";

    calculateTotal() {
        
        let subtotal = 0
        let discount = 0;
        let tax = 0;

        this.Lines.forEach((line => {
            subtotal += (line.price as any) * line.qty
            discount = (line.discount as any ) + discount
            tax = (line.taxAmount as any ) + tax
        }))



        this.itemsTotal = subtotal; //9
        this.discount = discount; // 1
        this.subTotal = subtotal - this.discount; //9-1 = 8
        this.tax = tax // 0.8
        this.total =  this.subTotal + this.tax; 



    }


    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {

                this[key as keyof typeof this] = json[key];


            }
        }
    }
}


export class InvoiceLines {
    constructor() {
        // this.job_title = new Role();
    }
    id: number | null = null;
    invoiceId: number | null = null;
    serviceId: number | null = null;
    serviceName: string = "";
    price: number | null = null;
    isBranch: boolean = false;
    refrenceId: string = "";
    service: any;
    qty: number = 1
    slug = "";

    discount = 0;
    taxPercent = 10;
    taxAmount = 0;
    total = 0;




    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {

                this[key as keyof typeof this] = json[key];


            }
        }
    }



    calculateTotal() {
        this.total = (this.qty * (this.price as any)) - this.discount;
        this.taxAmount = this.total * (this.taxPercent / 100)
        this.total = this.total * ((this.taxPercent / 100) + 1)
    }





}


