import { PrivilegeSetting } from "../models/privilege-setting.model";

export function chequeBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Cheque Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Cheque Template",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Cheque Template List",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Cheque Template",
        securityType: "cloud",
      }),
    }
  });
}
