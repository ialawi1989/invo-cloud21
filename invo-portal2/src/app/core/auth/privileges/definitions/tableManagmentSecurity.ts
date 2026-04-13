import { PrivilegeSetting } from "../models/privilege-setting.model";

export function tableManagmentSecurity() {
  return new PrivilegeSetting({
    name: "Table Managment Security",
    securityType: "cloud",
    securityGroup: "settings",
  });
}
