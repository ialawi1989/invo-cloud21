import { PrivilegeSetting } from "../models/privilege-setting.model";

export function billOfEntrySecurity() {
  return new PrivilegeSetting({
    name: "Bill Of Entry Security",
      securityType: "cloud",
      securityGroup: "purchase",
      actions: {
        "add": new PrivilegeSetting({
          name: "Add/Edit Bill Of Entry",
          securityType: "cloud",
        }),
        "view": new PrivilegeSetting({
          name: "View Bill Of Entry",
          securityType: "cloud",
        }),
        "delete": new PrivilegeSetting({
          name: "Delete Bill Of Entry",
          securityType: "cloud",
        })
      }
  });
}
