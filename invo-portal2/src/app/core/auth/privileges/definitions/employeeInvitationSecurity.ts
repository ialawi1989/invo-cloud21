import { PrivilegeSetting } from "../models/privilege-setting.model";

export function employeeInvitationSecurity() {
  return new PrivilegeSetting({
    name: "Employee Invitation Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "add": new PrivilegeSetting({
        name: "Employee Invite",
        securityType: "cloud",
      }),
    }
  });
}
