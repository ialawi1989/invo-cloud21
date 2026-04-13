import { PrivilegeSetting } from "../models/privilege-setting.model";

export function coveredAddress() {
  return new PrivilegeSetting({
    name: "Covered Address",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Covered Address",
        securityType: "cloud",
      })
    }
  });
}
