import { PrivilegeSetting } from "../models/privilege-setting.model";

export function pagingSecurity() {
  return new PrivilegeSetting({
    name: "Paging Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Paging",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Paging",
        securityType: "cloud",
      })
    }
  });
}
