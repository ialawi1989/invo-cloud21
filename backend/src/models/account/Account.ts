import { Log } from "../log";

export class Account {
    id = "";
    name = "";
    description = "";
    code = "";

    type = "";
    parentType = "" // CAN BE ONE OF THE FOLLOEING [Operating Income,Current Assets,Other Current Assets,Costs of Goods Sold,Current Liabilities,Expense]

    companyId = "";
    parentId:string|null = null;
    hasChild = false;

    default = false; // TO INDICATE DEFAULT => TRUE // DEFAULT ACCOUNTS ARE NOT EDITABLE 

    accountNature = "";// TO IDENTIFY  if the ACCOUNT IS CR =>(Credit) or Dr => (Debit) 
    /**
     * see setAccountNature() bellow for more details 
    */

    logs: Log[] = [];
    openingBalance =0;

    translation:any ={};
    
    //TODO: ADD TRANSALTION 
    // DEAFULT ACCOUNTS WILL BE ADDED WHEN A COMPANY IS CREATED 
    accountTypes() {
        return [{ name: "Sales", code: "", type: "Sales", parentType: "Operating Income", description: "", default: true,translation:{name:{"ar": "المبيعات","en": "Sales"}}},
        { name: "Account Receivable", code: "", type: "Account Receivable", parentType: "Current Assets", description: "", default: true,translation:{name:{"ar": "الحسابات المستحقة","en": "Account Receivable"}} },
        { name: "Costs Of Goods Sold", code: "", type: "Costs Of Goods Sold", parentType: "Costs Of Goods Sold", description: "", default: true,translation:{name:{"ar": "تكاليف التشغيل","en": "Costs Of Goods Sold"}} },
        { name: "Inventory Assets", code: "", type: "Inventory Assets", parentType: "Other Current Assets", description: "", default: true,translation:{name:{"ar": "المخرون","en": "Inventory Assets"}} },
        { name: "Bank", type: "Bank", code: "", parentType: "Current Assets", description: "", default: true,translation:{name:{"ar": "البنك","en": "Bank"}} },
        { name: "Cash", type: "Cash", code: "", parentType: "Current Assets", description: "", default: true ,translation:{name:{"ar": "النقد","en": "Cash"}}},
        { name: "Account Payable", code: "", type: "Account Payable", parentType: "Current Liabilities", description: "", default: true  ,translation:{name:{"ar": "ذمم دائنة","en": "Account Payable"}}},
        { name: "Discount", code: "", type: "Discount", parentType: "Operating Income", description: "", default: true ,translation:{name:{"ar": "التخفيض","en": "Discount"}} },
        { name: "Output Vat", code: "", type: "Current Liabilities", parentType: "Current Liabilities", description: "", default: true,translation:{name:{"ar": "مخرجات الضريبة على القيمة المضافة","en": "Output Vat"}}  },
        { name: "Input Vat", code: "", type: "Other Current Assets", parentType: "Other Current Assets", description: "", default: true,translation:{name:{"ar": "ادخال الضريبة على القيمة المضافة","en": "Input Vat"}}  },
        { name: "Commission Liabilities", code: "", type: "Commission Liabilities", parentType: "Current Liabilities", description: "", default: true,translation:{name:{"ar": "مطالبات العمولة","en": "Commission Liabilities"}}  },
        { name: "Commission Expense", code: "", type: "Commission Expense", parentType: "Operating Expense", description: "", default: true ,translation:{name:{"ar": "مصاريف العمولة","en": "Commission Expense"}} },
        { name: "Charges Income", code: "", type: "Charges Income", parentType: "Operating Income", description: "", default: true ,translation:{name:{"ar": "رسوم الدخل","en": "Charges Income"}}},
        { name: "Delivery Charge", code: "", type: "Delivery Charge", parentType: "Operating Income", description: "", default: true ,translation:{name:{"ar": "رسوم التوصيل","en": "Delivery Charge"}}},
        { name: "Prepaid Expenses", code: "", type: "Prepaid Expenses", parentType: "Current Assets", description: "", default: true,translation:{name:{"ar": "مصروفات مدفوعة مسبقا","en": "Prepaid Expenses"}} },
        { name: "Unearend Revenue", code: "", type: "Unearend Revenue", parentType: "Current Liabilities", description: "", default: true ,translation:{name:{"ar": "الايرادات الغير مستحقة","en": "Unearend Revenue"}}},
        { name: "Customer Credit", code: "", type: "Customer Credit", parentType: "Current Liabilities", description: "", default: true ,translation:{name:{"ar": "ائتمان العملاء","en": "Customer Credit"}}},
        { name: "Available Credit", type: "Available Credit", code: "", parentType: "Current Assets", description: "", default: true,translation:{name:{"ar": "الرصيد المتوفر","en": "Available Credit"}} },
        { name: "Rounding", type: "Rounding", code: "", parentType: "Operating Income", description: "", default: true,translation:{name:{"ar": "قيمة التقريب","en": "Rounding"}} },
        { name: "Bad Debts", code: "", type: "Other Expense", parentType: "Operating Expense", description: "", default: true ,translation:{name:{"ar": "ديون غير قابلة للتحصيل","en": "Bad Debts"}}},
        { name: "Bank Charge", code: "", type: "Other Expense", parentType: "Operating Expense", description: "", default: true,translation:{name:{"ar": "رسوم البنك","en": "Bank Charge"}} },
        { name: "Payout", code: "", type: "Cash", parentType: "Current Assets", description: "", default: true,translation:{name:{"ar": "الدفع خارج الصندوق","en": "Payout"}} },
        { name: "Opening Balance Adjusment", code: "", type: "Equity", parentType: "Equity", description: "", default: true,translation:{name:{"ar": "تعديل الرصيد الافتتاحي","en": "Opening Balance Adjusment"}}  },
        { name: "Retained Earning", code: "", type: "Equity", parentType: "Equity", description: "", default: true,translation:{name:{"ar": "احتياطي رأس مالي","en": "Retained Earning"}} },
        { name: "Purchase Discounts", code: "", type: "Other Expense", parentType: "Operating Expense", description: "", default: true ,translation:{name:{"ar": "التخفيض المكتسب","en": "Purchase Discounts"}} },

        ]
    }

    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    //To set the account nature accordingly to the account's parent type 
    // Cr=> (credit)
    // Dr=> (credit)
    // when the account nature is Cr means that the account increase by credit 
    // when the account nature is Dr means that the account increase by Debit  
    setAccountNature() {
        switch (this.parentType) {
            case "Current Assets":
                this.accountNature = "Dr"
                break;
            case "Other Current Assets":
                this.accountNature = "Dr"
                break;
            case "Fixed Assets":
                this.accountNature = "Dr"
                break;
            case "Operating Expense":
                this.accountNature = "Dr"
                break;
            case "Costs Of Goods Sold":
                this.accountNature = "Dr"
                break;
            case "Income":
                this.accountNature = "Cr"
                break;
            case "Operating Income":
                this.accountNature = "Cr"
                break;
            case "Liabilities":
                this.accountNature = "Cr"
                break;
            case "Current Liabilities":
                this.accountNature = "Cr"
                break;
            case "Long Term Liabilities":
                this.accountNature = "Cr"
                break;
            case "Equity":
                this.accountNature = "Cr"
                break;
        }
    }

    validateParentType(){
        try {
            let parentType = ['Current Assets',
                'Other Current Assets',
                'Fixed Assets',
                'Current Liabilities',
                'Long Term Liabilities',
                'Equity',
                'Operating Income',
                'Costs Of Goods Sold',
                'Operating Expense',
                'Other Current Liabilities',
                 'Non Current Assets'
            ]

            if (!parentType.includes(this.parentType)) {
                throw new Error("Invalid parent type: " + this.parentType);
            }
        } catch (error) {
            throw new Error("Invalid parent type: " + this.parentType);
        }
    }
}