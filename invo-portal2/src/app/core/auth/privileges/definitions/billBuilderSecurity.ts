import { PrivilegeSetting } from "../models/privilege-setting.model";

export function billBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Bill Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Bill Template",
        securityType: "cloud",
      }),
    }
  });
}
