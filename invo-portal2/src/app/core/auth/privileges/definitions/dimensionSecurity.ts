import { PrivilegeSetting } from "../models/privilege-setting.model";

export function dimensionSecurity() {
  return new PrivilegeSetting({
    name: "Dimension Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Dimension",
        securityType: "cloud",
      }),
      "add": new PrivilegeSetting({
        name: "Add/Edit Dimension",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Dimension",
        securityType: "cloud",
      })
    }
  });
}
