export class OpeningBalanceAccount{
    id="";
    openingBalance =0;
    accountId="";
    branchId="";
    companyId="";

    debit=0;
    credit=0
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}