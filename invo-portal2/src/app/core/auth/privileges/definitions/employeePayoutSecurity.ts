import { PrivilegeSetting } from "../models/privilege-setting.model";

/** Employee payouts, and viewing the commission they pay (names match the backend privilege). */
export function employeePayoutSecurity() {
  return new PrivilegeSetting({
    name: "Employee Payouts Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "add": new PrivilegeSetting({ name: "Add Employee Payouts", securityType: "cloud" }),
      "edit": new PrivilegeSetting({ name: "Edit Employee Payouts", securityType: "cloud" }),
      "view": new PrivilegeSetting({ name: "View Employee Commissions and Payouts", securityType: "cloud" }),
      "delete": new PrivilegeSetting({ name: "Delete Employee Payouts", securityType: "cloud" }),
    }
  });
}
