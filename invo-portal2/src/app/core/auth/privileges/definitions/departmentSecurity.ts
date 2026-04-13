import { PrivilegeSetting } from "../models/privilege-setting.model";

export function departmentSecurity() {
  return new PrivilegeSetting({
    name: "Department Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Department",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Department",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Department",
        securityType: "cloud",
      })
    }
  });
}
