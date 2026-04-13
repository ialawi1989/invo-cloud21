import { PrivilegeSetting } from "../models/privilege-setting.model";

export function bankingOverview() {
  return new PrivilegeSetting({
    name: "Banking Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Banking",
        securityType: "cloud",
      })
    }
  });
}
