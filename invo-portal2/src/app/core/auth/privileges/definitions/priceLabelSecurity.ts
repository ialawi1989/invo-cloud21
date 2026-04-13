import { PrivilegeSetting } from "../models/privilege-setting.model";

export function priceLabelSecurity() {
  return new PrivilegeSetting({
    name: "Price Label Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add Price Label",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Price Label",
        securityType: "cloud",
      })
    }
  });
}
