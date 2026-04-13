import { PrivilegeSetting } from "../models/privilege-setting.model";

export function expenseSecurity() {
  return new PrivilegeSetting({
    name: "Expense Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Expense Security",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Expense Security",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Expense Security",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Expense Security",
        securityType: "cloud",
      }),
      "clone": new PrivilegeSetting({
        name: "Clone Expense Security",
        securityType: "cloud",
      })
    }
  });
}
