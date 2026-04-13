import { PrivilegeSetting } from "../models/privilege-setting.model";

export function shippingSecurity() {
  return new PrivilegeSetting({
    name: "Shipping Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Shipping",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Shipping",
        securityType: "cloud",
      }),
    }
  });
}
