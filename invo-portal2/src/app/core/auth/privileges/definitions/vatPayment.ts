import { PrivilegeSetting } from "../models/privilege-setting.model";

export function vatPayment() {
  return new PrivilegeSetting({
    name: "VatPayment Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit VatPayment",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View VatPayment",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete VatPayment",
        securityType: "cloud",
      }),
    }
  });
}
