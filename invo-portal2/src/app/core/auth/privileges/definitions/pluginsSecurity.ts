import { PrivilegeSetting } from "../models/privilege-setting.model";

export function pluginsSecurity() {
  return new PrivilegeSetting({
    name: "Plugins Security",
    securityType: "cloud",
    securityGroup: "general",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Plugins",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit Plugins",
        securityType: "cloud",
      })
    }
  });
}
