import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee Disciplinary Security — warnings and appeals. Confidential.
 *
 * The most restricted of the HR groups. `decideAppeal` is separate from
 * `edit` because whoever issued a warning must not rule on the appeal
 * against it; the server refuses that case even for someone holding both.
 *
 * The employee always reads their own record and writes their own statement
 * while the response window is open — a warning nobody may show the employee
 * is not a warning.
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
export function employeeDisciplinarySecurity() {
  return new PrivilegeSetting({
    name: "Employee Disciplinary Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Disciplinary Records",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Issue/Edit Disciplinary Records",
        securityType: "cloud",
      }),
      "decideAppeal": new PrivilegeSetting({
        name: "Decide Disciplinary Appeals",
        securityType: "cloud",
      }),
    }
  });
}
