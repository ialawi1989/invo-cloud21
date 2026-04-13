import { PrivilegeSetting } from "../models/privilege-setting.model";

export function inventoryPhysicalCountsSecurity() {
  return new PrivilegeSetting({
    name: "Physical Counts Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Physical Counts",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Physical Counts",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Physical Counts",
        securityType: "cloud",
      }),
      "calculateLines": new PrivilegeSetting({
        name: "Calculate Physical Counts lines",
        securityType: "cloud",
      }),
      "commitLines": new PrivilegeSetting({
        name: "Commit Physical Counts lines",
        securityType: "cloud",
      }),
    }
  });
}
