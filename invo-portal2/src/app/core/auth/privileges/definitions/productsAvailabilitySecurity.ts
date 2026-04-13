import { PrivilegeSetting } from "../models/privilege-setting.model";

export function productsAvailabilitySecurity() {
  return new PrivilegeSetting({
    name: "Products Availability Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Products Availability",
        securityType: "cloud",
      })
    }
  });
}
