import { PrivilegeSetting } from "../models/privilege-setting.model";

export function companiesOverviewSecurity() {
  return new PrivilegeSetting({
    name: "Companies Overview Security",
    securityType: "cloud",
    securityGroup: "dashboard",
  });
}
