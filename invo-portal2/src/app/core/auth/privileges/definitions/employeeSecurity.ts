import { PrivilegeSetting } from "../models/privilege-setting.model";

export function employeeSecurity() {
  return new PrivilegeSetting({
    name: "Employee Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Employee",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Employee",
        securityType: "cloud",
      })
    }
  });
}
