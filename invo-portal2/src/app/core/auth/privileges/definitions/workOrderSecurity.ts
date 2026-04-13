import { PrivilegeSetting } from "../models/privilege-setting.model";

export function workOrderSecurity() {
  return new PrivilegeSetting({
    name: "Work Order Security",
    securityType: "cloud",
    securityGroup: "sales",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add New Work Order",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Work Order",
        securityType: "cloud",
      })
    }
  });
}
