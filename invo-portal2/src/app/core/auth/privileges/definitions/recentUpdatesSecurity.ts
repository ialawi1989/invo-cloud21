import { PrivilegeSetting } from "../models/privilege-setting.model";

export function recentUpdatesSecurity() {
  return new PrivilegeSetting({
    name: "Recent Updates Security",
    securityType: "cloud",
    securityGroup: "general",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Recent Updates",
        securityType: "cloud",
      }),
    }
  })
}
