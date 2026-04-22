import { Invoice} from "./Invoice";

export class RecurringInvoice {
    id =""; 
    name =""; 
    branchId:string|null;
    createdAt= new Date(); 
    updatedDate= new Date(); 
    type = "sechedule"
    customerId:string|null;
    startDate :Date = new Date() 
     endDate :null|Date = null
     endTerm = 'none'
     repeatData = {}
     invoiceCreatedBefore:Number= 0
     transactionDetails :any = {}
     hasInvoices = false;
    //  getTransactionDetails():any|null{
    //     this.transactionDetails = new Invoiceing()
    //     this.transactionDetails.ParseJson(this.transactionDetails)
    //     return this.transactionDetails;

    // }

     

    constructor(){
        this.customerId = null 
        this.branchId = null
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "transactionDetails" && json[key]!=='{}') {
                let invoiceTemp=  new Invoice();
                invoiceTemp.ParseJson(json[key])
                this.transactionDetails = invoiceTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }


    

}





