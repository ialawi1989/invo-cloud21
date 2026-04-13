import { PrivilegeSetting } from "../models/privilege-setting.model";

export function optionGroupSecurity() {
  return new PrivilegeSetting({
    name: "Option Group Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Option Group",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Option Group",
        securityType: "cloud",
      }),
      "clone": new PrivilegeSetting({
        name: "Clone Option Group",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Option Group",
        securityType: "cloud",
      })
    }
  });
}
