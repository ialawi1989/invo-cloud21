interface Period{
    to:string,/** table/field of comparison */
    ftom:string,/** condition of comparison ["isEqual","isNotEqual","startsWith","endsWith","contains","notContain"] */ 
   
} 
export class BudgetLine {
    id = "";
    accountId = "";
    budgetId = "";

    prediction = 0;
    actualAmount =0;
    createdAt = new Date();
    periodFilter ="";
    period :{}|null = null;

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}



