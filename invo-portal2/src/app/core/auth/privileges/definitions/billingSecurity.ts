import { PrivilegeSetting } from "../models/privilege-setting.model";

export function billingSecurity() {
  return new PrivilegeSetting({
    name: "Billing Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Bill",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Bill",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Bill",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Bill",
        securityType: "cloud",
      }),
      "clone": new PrivilegeSetting({
        name: "Clone Bill",
        securityType: "cloud",
      }),
      "pay": new PrivilegeSetting({
        name: "Pay Bill",
        securityType: "cloud",
      }),
      "openBill": new PrivilegeSetting({
        name: "Open Bill",
        securityType: "cloud",
      })
    }
  })

 
 
;
}
