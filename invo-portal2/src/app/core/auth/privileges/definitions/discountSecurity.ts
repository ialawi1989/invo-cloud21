import { PrivilegeSetting } from "../models/privilege-setting.model";

export function discountSecurity() {
  return new PrivilegeSetting({
    name: "Discount Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add/edit Discounts",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Discounts",
        securityType: "cloud",
      })
    }
  });
}
