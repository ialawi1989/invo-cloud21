import { PrivilegeSetting } from "../models/privilege-setting.model";

export function billingPaymentsSecurity() {
  return new PrivilegeSetting({
    name: "Billing Payments Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Billing Payment",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Billing Payment",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Billing Payment",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Billing Payment",
        securityType: "cloud",
      })
    }
  });
}
