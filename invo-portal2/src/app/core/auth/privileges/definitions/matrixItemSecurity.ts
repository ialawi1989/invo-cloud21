import { PrivilegeSetting } from "../models/privilege-setting.model";

export function matrixItemSecurity() {
  return new PrivilegeSetting({
    name: "Matrix Item Security",
    securityType: "common",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add New Matrix Item",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Matrix Item",
        securityType: "cloud",
      }),

     }
  });
}
