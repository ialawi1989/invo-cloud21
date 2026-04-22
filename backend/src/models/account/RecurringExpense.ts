import { Expense } from "./Expense";

export class RecurringExpense {
    id =""; 
    name =""; 
    branchId:null|string = null
    createdAt= new Date(); 
    updatedDate= new Date(); 
    type = "sechedule"
    customerId :string|null = null
    supplierId :string|null = null
    paymentMethodId  :string|null = null
    startDate :Date = new Date() 
     endDate :null|Date = null
     endTerm = 'none'
     repeatData = {}
     expenseCreatedBefore:Number= 0
     transactionDetails :any = {}
     hasExpense = false
    //  getTransactionDetails():any|null{
    //     this.transactionDetails = new Invoiceing()
    //     this.transactionDetails.ParseJson(this.transactionDetails)
    //     return this.transactionDetails;

    // }

     

    constructor(){}

    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "transactionDetails" && json[key]!=='{}') {
                let expenseTemp=  new Expense();
                expenseTemp.ParseJson(json[key])
                this.transactionDetails = expenseTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }


    

}





