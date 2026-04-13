import { PrivilegeSetting } from "../models/privilege-setting.model";

export function purchaseOrderSecurity() {
  return new PrivilegeSetting({
    name: "Purchase Order Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Purchase Order",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Purchase Order",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Purchase Order",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Purchase Order",
        securityType: "cloud",
      }),
      "convert": new PrivilegeSetting({
        name: "Convert Purchase Order to Bill",
        securityType: "cloud",
      }),
      "auto": new PrivilegeSetting({
        name: "Auto Purchase Order",
        securityType: "cloud",
      })
    }
  })



;
}
