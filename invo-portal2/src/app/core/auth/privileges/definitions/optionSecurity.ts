import { PrivilegeSetting } from "../models/privilege-setting.model";

export function optionSecurity() {
  return new PrivilegeSetting({
    name: "Option Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Option",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Option",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Option",
        securityType: "cloud",
      }),
      "optionAvailable": new PrivilegeSetting({
        name: "Option Available",
        securityType: "cloud",
      }),
      "clone": new PrivilegeSetting({
        name: "Clone Option",
        securityType: "cloud",
      }),
      "importExport": new PrivilegeSetting({
        name: "Import/Export Option",
        securityType: "cloud",
      })
    }
  });
}
