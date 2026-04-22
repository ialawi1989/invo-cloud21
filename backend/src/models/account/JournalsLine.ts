export class JournalLine {
    id = "";
    dbTable = "";
    dbTableId: string | null;
    code = "";
    description = "";
    journalId = "";
    accountId = "";
    credit = 0;
    debit = 0;
    createdAt = new Date();
    type = "";// system , user
    amount = 0;
    isVoided = false;
    reconciled=false;
    reconciliationId:string|null;
    branchId= "";
    companyId = ""
    constructor() {
        this.dbTableId = null;
        this.reconciliationId = null;
        
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}