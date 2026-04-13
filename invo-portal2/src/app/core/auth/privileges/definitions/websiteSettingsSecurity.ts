import { PrivilegeSetting } from "../models/privilege-setting.model";

export function websiteSettingsSecurity() {
  return new PrivilegeSetting({
    name: "Website Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Page",
        securityType: "cloud",
      })
    }
  });
}
