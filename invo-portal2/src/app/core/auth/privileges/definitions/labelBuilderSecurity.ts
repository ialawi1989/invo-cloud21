import { PrivilegeSetting } from "../models/privilege-setting.model";

export function labelBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Label Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Label Template",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Label Template List",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Label Template",
        securityType: "cloud",
      }),
    }
  });
}
