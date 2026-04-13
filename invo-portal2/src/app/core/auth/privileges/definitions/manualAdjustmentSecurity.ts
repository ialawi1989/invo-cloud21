import { PrivilegeSetting } from "../models/privilege-setting.model";

export function manualAdjustmentSecurity() {
  return new PrivilegeSetting({
    name: "Manual Adjustment Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Manual Adjustment",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Manual Adjustment",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Manual Adjustment",
        securityType: "cloud",
      })
    }
  });
}
