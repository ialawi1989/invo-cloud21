import { PrivilegeSetting } from "../models/privilege-setting.model";

export function accountSecurity() {
  return new PrivilegeSetting({
    name: "Account Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Account",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Account",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Account",
        securityType: "cloud",
      }),
      "importExport": new PrivilegeSetting({
        name: "Import/Export Account",
        securityType: "cloud",
      })
    }
  });
}
