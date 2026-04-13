import { PrivilegeSetting } from "../models/privilege-setting.model";

export function recieptBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Reciept Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Reciept Template",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Reciept Template List",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Reciept Template",
        securityType: "cloud",
      }),
    }
  });
}
