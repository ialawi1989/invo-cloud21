import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee Payroll Security — salary, components, bank details and loans.
 *
 * Four grants, not one. Pay and bank details are separated because the
 * people who set salaries and the people who run transfers are not the same
 * people: someone reconciling a failed transfer needs the IBAN and has no
 * business knowing the salary.
 *
 * `editBank` is separate from `viewBank` for the oldest reason in payroll —
 * the fraud is changing an account number, not reading one.
 *
 * There is deliberately NO line-manager path here. Whether a manager sees
 * salary or only a band is an open product question, so a manager sees pay
 * only if granted `viewPay` explicitly.
 *
 * **Default-DENY on the server.** Every action here must be granted explicitly;
 * an unset key is not a grant. Do not assume a role can do any of this until
 * someone ticks it — see features/employees/hr-privilege.ts for why the portal
 * cannot use the usual default-allow check for these.
 *
 * The action strings are a contract with the API and are pinned on both sides
 * (hr-privilege-contract.spec.ts here, hrPrivilegeContract.test.ts on the
 * server). A misspelling produces a grant that ticks on, saves, and denies
 * every request. Renaming one silently revokes every grant already issued.
 */
export function employeePayrollSecurity() {
  return new PrivilegeSetting({
    name: "Employee Payroll Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "viewPay": new PrivilegeSetting({
        name: "View Salary and Components",
        securityType: "cloud",
      }),
      "editPay": new PrivilegeSetting({
        name: "Edit Salary and Components",
        securityType: "cloud",
      }),
      "viewBank": new PrivilegeSetting({
        name: "View Bank Details",
        securityType: "cloud",
      }),
      "editBank": new PrivilegeSetting({
        name: "Edit Bank Details",
        securityType: "cloud",
      }),
    }
  });
}
