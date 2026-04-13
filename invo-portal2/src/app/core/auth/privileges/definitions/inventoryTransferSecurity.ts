import { PrivilegeSetting } from "../models/privilege-setting.model";

export function inventoryTransferSecurity() {
  return new PrivilegeSetting({
    name: "Inventory Transfer Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Inventory Transfer",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Inventory Transfer",
        securityType: "cloud",
      }),
      "showProductCost": new PrivilegeSetting({
        name: "Show Product Cost",
        securityType: "cloud",
      }),
      "confirm": new PrivilegeSetting({
        name: "Confirm Inventory Transfer",
        securityType: "cloud",
      }),
    }
  });
}
