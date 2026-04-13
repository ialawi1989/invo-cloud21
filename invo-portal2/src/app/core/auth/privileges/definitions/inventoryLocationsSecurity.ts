import { PrivilegeSetting } from "../models/privilege-setting.model";

export function inventoryLocationsSecurity() {
  return new PrivilegeSetting({
    name: "Inventory Locations Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Inventory Locations",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Inventory Locations",
        securityType: "cloud",
      }),

     }
  });
}
