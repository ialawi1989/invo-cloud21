import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee Performance Security — reviews, goals and training records.
 *
 * `calibrate` is separate from `edit`: the point of moderation is that it is
 * not the reviewer restating their own arithmetic. The computed score is
 * never overwritten — both figures are returned.
 *
 * The employee writes their own self-assessment and acknowledges the
 * outcome; a review is not final until they do.
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
export function employeePerformanceSecurity() {
  return new PrivilegeSetting({
    name: "Employee Performance Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Performance Reviews",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Conduct Performance Reviews",
        securityType: "cloud",
      }),
      "calibrate": new PrivilegeSetting({
        name: "Calibrate Review Scores",
        securityType: "cloud",
      }),
    }
  });
}
