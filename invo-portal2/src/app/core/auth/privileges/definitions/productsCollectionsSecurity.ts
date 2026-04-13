import { PrivilegeSetting } from "../models/privilege-setting.model";

export function productsCollectionsSecurity() {
  return new PrivilegeSetting({
    name: "Products Collections Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Products Collections",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Products Collections",
        securityType: "cloud",
      })
    }
  });
}
