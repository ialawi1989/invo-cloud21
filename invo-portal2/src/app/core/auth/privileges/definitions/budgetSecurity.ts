import { PrivilegeSetting } from "../models/privilege-setting.model";

export function budgetSecurity() {
  return new PrivilegeSetting({
    name: "Budget Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add/edit Budget",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Budget",
        securityType: "cloud",
      })

     }
  });
}
