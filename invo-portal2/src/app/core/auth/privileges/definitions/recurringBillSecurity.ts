import { PrivilegeSetting } from "../models/privilege-setting.model";

export function recurringBillSecurity() {
  return new PrivilegeSetting({
    name: "Recurring Bill Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Recurring Bill",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Recurring Bill",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Recurring Bill",
        securityType: "cloud",
      })
    }
  })

 
 
;
}
