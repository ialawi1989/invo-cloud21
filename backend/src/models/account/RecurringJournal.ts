

import { Journal } from "./Journal";


export class RecurringJournal {
    id =""; 
    name =""; 
    branchId=""; 
    createdAt= new Date(); 
    updatedDate= new Date(); 
    type = "sechedule"
    startDate :Date = new Date() 
     endDate :null|Date = null
     endTerm = 'none'
     repeatData = {}
     journalCreatedBefore:Number= 0
     transactionDetails :any = {}

    //  getTransactionDetails():any|null{
    //     this.transactionDetails = new Invoiceing()
    //     this.transactionDetails.ParseJson(this.transactionDetails)
    //     return this.transactionDetails;

    // }

     

    constructor(){}

    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "transactionDetails" && json[key]!=='{}') {
                let journalTemp=  new Journal();
                journalTemp.ParseJson(json[key])
                this.transactionDetails = journalTemp;
            } else {
                if (key in this) {
                    this[key as keyof typeof this] = json[key];
                }
            }
        }
    }


    

}



