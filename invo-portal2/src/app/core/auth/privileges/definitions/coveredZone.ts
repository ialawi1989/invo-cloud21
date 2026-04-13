import { PrivilegeSetting } from "../models/privilege-setting.model";

export function coveredZone() {
  return new PrivilegeSetting({
    name: "Covered Zone",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Covered Zone",
        securityType: "cloud",
      })
    }
  });
}
