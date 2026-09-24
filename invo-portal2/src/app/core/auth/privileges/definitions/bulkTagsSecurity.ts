import { PrivilegeSetting } from "../models/privilege-setting.model";

export function bulkTagsSecurity() {
  return new PrivilegeSetting({
    name: "Bulk Tags Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Bulk Tags",
        securityType: "cloud",
      })
    }
  });
}
