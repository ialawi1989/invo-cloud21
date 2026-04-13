import { PrivilegeSetting } from "../models/privilege-setting.model";

export function branchSettingsSecurity() {
  return new PrivilegeSetting({
    name: "Branch Settings Security",
    securityType: "cloud",
    securityGroup: "branch",
    actions: {
      "add": new PrivilegeSetting({
        name: "Edit Branch Settings",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Branch List",
        securityType: "cloud",
      })
    }
  });
}
