import { PrivilegeSetting } from "../models/privilege-setting.model";

export function websiteBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Website Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Website Builder",
        securityType: "cloud",
      }),
    }
  });
}
