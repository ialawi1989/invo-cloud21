import { PrivilegeSetting } from "../models/privilege-setting.model";

export function priceManagementSecurity() {
  return new PrivilegeSetting({
    name: "Price Managment Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "add Price Managment",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Price Managment",
        securityType: "cloud",
      })
    }
  });
}
