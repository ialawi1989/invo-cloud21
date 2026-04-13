import { PrivilegeSetting } from "../models/privilege-setting.model";

export function recurringInvoiceSecurity() {
  return new PrivilegeSetting({
    name: "Recurring Invoice Security",
    securityType: "cloud",
    securityGroup: "sales",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Recurring Invoice",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Recurring Invoice",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Recurring Invoice",
        securityType: "cloud",
      })
    }
  });
}
