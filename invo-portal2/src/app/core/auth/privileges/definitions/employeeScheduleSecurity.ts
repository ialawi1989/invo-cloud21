import { PrivilegeSetting } from "../models/privilege-setting.model";

export function employeeScheduleSecurity() {
  return new PrivilegeSetting({
    name: "Employee Schedule Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "Control Schedule",
        securityType: "cloud",
      }),
    }
  });
}
