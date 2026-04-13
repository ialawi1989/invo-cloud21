import { PrivilegeSetting } from "../models/privilege-setting.model";

export function businessSettingsSecurity() {
  return new PrivilegeSetting({
    name: "Business Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Business Settings Security",
        securityType: "cloud",
      }),
    }
  });
}
