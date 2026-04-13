import { PrivilegeSetting } from "../models/privilege-setting.model";

export function pageBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Page Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Page",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Page",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Page",
        securityType: "cloud",
      }),
    }
  });
}
