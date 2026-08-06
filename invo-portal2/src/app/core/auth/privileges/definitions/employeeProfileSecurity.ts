import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Personal / HR data on an employee — the `profile.*` and `employment.*`
 * groups, as distinct from `employeeSecurity`, which guards the *account*
 * (roles, credentials, privilege set).
 *
 * `viewSensitive` covers the fields marked `restricted` in the field manifest
 * (seniority date, grade, cost centre, dependants) — the ones an ordinary
 * cloud admin has no business reading.
 *
 * The later phases add their own groups alongside this one (documents,
 * payroll, leave, …). Nothing renames an existing group: `employeeAttendence-
 * Security` keeps its misspelling, because a privilege path is stored data and
 * renaming it silently locks users out.
 */
export function employeeProfileSecurity() {
  return new PrivilegeSetting({
    name: "Employee Profile Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Employee Profile",
        securityType: "cloud",
      }),
      "add": new PrivilegeSetting({
        name: "Add/Edit Employee Profile",
        securityType: "cloud",
      }),
      "viewSensitive": new PrivilegeSetting({
        name: "View Restricted Profile Fields",
        securityType: "cloud",
      })
    }
  });
}
