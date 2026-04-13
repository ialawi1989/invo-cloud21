import { PrivilegeSetting } from "../models/privilege-setting.model";

export function estimateBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Estimate Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Estimate Template",
        securityType: "cloud",
      }),
    }
  });
}
