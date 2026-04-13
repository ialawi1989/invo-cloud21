import { PrivilegeSetting } from "../models/privilege-setting.model";

export function invoiceBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Invoice Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Invoice Template",
        securityType: "cloud",
      }),
    }
  });
}
