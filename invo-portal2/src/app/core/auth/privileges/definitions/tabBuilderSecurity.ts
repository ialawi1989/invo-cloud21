import { PrivilegeSetting } from "../models/privilege-setting.model";

export function tabBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Tab Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Tab Builder Template",
        securityType: "cloud",
      }),
    }
  });
}
