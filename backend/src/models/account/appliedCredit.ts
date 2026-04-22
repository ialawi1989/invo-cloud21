export class AppliedCredit {

id="";
invoiceId="";
creditNoteId ="";
amount =0; // credit note amount 
createdAt=new Date();
appliedCreditDate = new Date();
branchId="";
companyId=""
/**
 * 
 * apply credit journal
 * Unearend Expense => debit amount
 * Account Receivable => Credit amount
*/
employeeId="";
ParseJson(json:any): void{
    for (const key in json) {
        if(key in this)
        {
            this[key as keyof typeof this] = json[key];
        }
    
    }
}
}