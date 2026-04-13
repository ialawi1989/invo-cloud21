import { PrivilegeSetting } from "../models/privilege-setting.model";

export function recurringExpenseSecurity() {
  return new PrivilegeSetting({
    name: "Recurring Expense Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Recurring Expense",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Recurring Expense",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Recurring Expense",
        securityType: "cloud",
      })
    }
  })

 
 
;
}
