import { PrivilegeSetting } from "../models/privilege-setting.model";

export function prefixSettingsSecurity() {
  return new PrivilegeSetting({
    name: "Prefix Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Prefix Settings",
        securityType: "cloud",
      })
    }
  });
}
