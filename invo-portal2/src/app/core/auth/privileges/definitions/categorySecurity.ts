import { PrivilegeSetting } from "../models/privilege-setting.model";

export function categorySecurity() {
  return new PrivilegeSetting({
    name: "Category Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Category",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Category",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Category",
        securityType: "cloud",
      })
    }
  });
}
