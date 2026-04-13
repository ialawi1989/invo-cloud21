import { PrivilegeSetting } from "../models/privilege-setting.model";

export function salesTargetSecurity() {
  return new PrivilegeSetting({
    name: "Sales Target Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Target Security",
        securityType: "cloud",
      }),
    }
  });
}
