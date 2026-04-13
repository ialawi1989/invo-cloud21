import { PrivilegeSetting } from "../models/privilege-setting.model";

export function supplierSecurity() {
  return new PrivilegeSetting({
    name: "Supplier Security",
    securityType: "cloud",
    securityGroup: "purchase",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Supplier",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Supplier",
        securityType: "cloud",
      }),
      "importExport": new PrivilegeSetting({
        name: "Import/Export Supplier",
        securityType: "cloud",
      })
    }
  });
}
