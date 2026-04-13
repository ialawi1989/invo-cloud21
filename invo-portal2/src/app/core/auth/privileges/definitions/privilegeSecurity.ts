import { PrivilegeSetting } from "../models/privilege-setting.model";

export function privilegeSecurity() {
  return new PrivilegeSetting({
    name: "Privilege Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Privilege",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Privilege",
        securityType: "cloud",
      }),
      "clone": new PrivilegeSetting({
        name: "Clone Privilege",
        securityType: "cloud",
      })
    }
  });
}
