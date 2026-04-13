import { PrivilegeSetting } from "../models/privilege-setting.model";

export function customerSecurity() {
  return new PrivilegeSetting({
    name: "Customers Security",
    securityType: "common",
    securityGroup: "customer",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Customer",
        securityType: "common"
      }),
      "view": new PrivilegeSetting({
        name: "View Customers",
        securityType: "common"
      }),
      "deleteAddress": new PrivilegeSetting({
        name: "Delete Customer Address",
        securityType: "common"
      })
    }
  });
}
