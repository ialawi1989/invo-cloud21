import { PrivilegeSetting } from "../models/privilege-setting.model";

export function employeeAttendenceSecurity() {
  return new PrivilegeSetting({
    name: "Employee Attendence Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "edit": new PrivilegeSetting({
        name: "Edit Attendence",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Attendence",
        securityType: "cloud",
      }),
    }
  });
}
