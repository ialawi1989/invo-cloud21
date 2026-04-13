import { PrivilegeSetting } from "../models/privilege-setting.model";

export function companyGroupEmployeesSecurity() {
  return new PrivilegeSetting({
    name: "Company Group Employees Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "Control Schedule Company Group Employees",
        securityType: "cloud",
      }),
    }
  });
}
