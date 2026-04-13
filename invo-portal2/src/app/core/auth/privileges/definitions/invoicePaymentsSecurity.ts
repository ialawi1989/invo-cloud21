import { PrivilegeSetting } from "../models/privilege-setting.model";

export function invoicePaymentsSecurity() {
  return new PrivilegeSetting({
    name: "Invoice Payments Security",
    securityType: "cloud",
    securityGroup: "sales",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Invoice Payments",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Invoice Payments",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Invoice Payments",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Invoice Payments",
        securityType: "cloud",
      })
    }
  });
}
