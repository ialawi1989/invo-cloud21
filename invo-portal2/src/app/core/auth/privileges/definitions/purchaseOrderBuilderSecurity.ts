import { PrivilegeSetting } from "../models/privilege-setting.model";

export function purchaseOrderBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Purchase Order Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Purchase Order Template",
        securityType: "cloud",
      }),
    }
  });
}
