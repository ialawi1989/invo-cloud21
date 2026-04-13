import { PrivilegeSetting } from "../models/privilege-setting.model";

export function recipeSecurity() {
  return new PrivilegeSetting({
    name: "Recipe Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Recipe",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Recipe",
        securityType: "cloud",
      })
    }
  });
}
