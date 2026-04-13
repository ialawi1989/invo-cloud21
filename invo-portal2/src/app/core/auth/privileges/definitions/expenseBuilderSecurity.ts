import { PrivilegeSetting } from "../models/privilege-setting.model";

export function expenseBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Expense Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Expense Template",
        securityType: "cloud",
      }),
    }
  });
}
