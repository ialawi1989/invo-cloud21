
interface account {
    type: string;
    parentType: string;
  }
  
const accounts:account[] = [
            //current assets
            { type: "Bank"              , parentType: "Current Assets" },
            { type: "Cash"              , parentType: "Current Assets" },
            { type: "Current Assets"    , parentType: "Current Assets" },
            { type: "Account Receivable", parentType: "Current Assets" },
            { type: "Intangible Asset", parentType: "Non Current Assets" },
            
            //Other Current Assets
            { type: "Other Current Assets", parentType: "Other Current Assets" },
             
            // Fixed Assets
            { type: "Fixed Assets", parentType: "Fixed Assets" },
            
            // Liabilities
            { type: "Account Payable"    , parentType: "Current Liabilities" },
            { type: "Current Liabilities", parentType: "Current Liabilities" },
            
            //Other Current Liability
            { type: "Long Term Liabilities"     , parentType: "Long Term Liabilities" },
            { type: "Other Current Liabilities" , parentType: "Other Current Liabilities"},
               
            // Equity
            { type: "Equity"                , parentType: "Equity" },
            { type: "Sales"                 , parentType: "Operating Income" },
            { type: "Expense"               , parentType: "Operating Expense" },
            { type: "Other Income"          , parentType: "Operating Income"},  
            { type: "Income"          , parentType: "Operating Income"},  
            { type: "Other Expense"         , parentType: "Operating Expense"},
            { type: "Costs Of Goods Sold"   , parentType: "Costs Of Goods Sold" }
            ]

export class chartOfAccounts{
    public static async getAccounts() {
       return accounts
    }

    public static async getAccountParentType(type:string) {
        return accounts.find(item => item.type === type)?.parentType ??null
     }


}
