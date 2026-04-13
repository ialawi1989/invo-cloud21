import { PrivilegeSetting } from "../models/privilege-setting.model";

export function productRecipeSecurity() {
  return new PrivilegeSetting({
    name: "Product Recipe Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Product Recipe",
        securityType: "cloud",
      })
    }
  });
}
