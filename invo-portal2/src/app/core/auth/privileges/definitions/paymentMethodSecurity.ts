import { PrivilegeSetting } from "../models/privilege-setting.model";

export function paymentMethodSecurity() {
  return new PrivilegeSetting({
    name: "Payment Method Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add Payment Method",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Payment Method",
        securityType: "cloud",
      })
    }
  });
}
