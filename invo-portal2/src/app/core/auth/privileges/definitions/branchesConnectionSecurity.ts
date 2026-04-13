import { PrivilegeSetting } from "../models/privilege-setting.model";

export function branchesConnectionSecurity() {
  return new PrivilegeSetting({
    name: "Branches Connection Security",
    securityType: "cloud",
    securityGroup: "branch"
  });
}
