import { PrivilegeSetting } from "../models/privilege-setting.model";

export function branchPaymentsSecurity() {
  return new PrivilegeSetting({
    name: "Branch Payments Security",
    securityType: "cloud",
    securityGroup: "branch",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Branch Payments List",
        securityType: "cloud",
      })
    }
  });
}
