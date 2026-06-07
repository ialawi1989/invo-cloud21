import { PrivilegeSetting } from "../models/privilege-setting.model";

export function websiteAnalyticsSecurity() {
  return new PrivilegeSetting({
    name: "Store Analytics Security",
    securityType: "cloud",
    securityGroup: "website",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Store Analytics",
        securityType: "cloud",
      }),
    }
  });
}
