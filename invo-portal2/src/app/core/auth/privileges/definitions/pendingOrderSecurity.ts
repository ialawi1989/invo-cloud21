import { PrivilegeSetting } from "../models/privilege-setting.model";

export function pendingOrderSecurity() {
  return new PrivilegeSetting({
    name: "Pending Order Security",
    securityType: "cloud",
    securityGroup: "general",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Pending Order",
        securityType: "cloud",
      })
    }
  });
}
