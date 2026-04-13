import { PrivilegeSetting } from "../models/privilege-setting.model";

export function openCashDrawerSecurity() {
  return new PrivilegeSetting({
    name: "Manually Open Cash Drawer Security",
    securityType: "POS",
    securityGroup: "settings",
  });
}
