import { PrivilegeSetting } from "../models/privilege-setting.model";

export function taxSecurity() {
  return new PrivilegeSetting({
    name: "Tax Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add/edit Tax",
        securityType: "cloud",
      }),
      "assignTo": new PrivilegeSetting({
        name: "Tax assign to",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Tax",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Remove Tax",
        securityType: "POS",
      })
    }
  });
}
