import { PrivilegeSetting } from "../models/privilege-setting.model";

export function dashboardSecurity() {
  return new PrivilegeSetting({
    name: "Dashboard Security",
    securityType: "cloud",
    securityGroup: "dashboard"
  });
}
