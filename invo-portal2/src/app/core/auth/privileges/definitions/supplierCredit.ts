import { PrivilegeSetting } from "../models/privilege-setting.model";

export function supplierCredit() {
  return new PrivilegeSetting({
    name: "Supplier Credit Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Supplier Credit Security",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Supplier Credit Security",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Supplier Credit Security",
        securityType: "cloud",
      }),
      "refund": new PrivilegeSetting({
        name: "Refund Supplier Credit",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Supplier Credit",
        securityType: "cloud",
      }),
      "applyCredit": new PrivilegeSetting({
        name: "Apply Credit",
        securityType: "cloud",
      }),
    }
  });
}
