import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee GOSI Security — Bahrain social-insurance contribution settings.
 *
 * Company-wide statutory configuration: the Tier 1 (Bahraini) / Tier 2 (GCC)
 * contribution-rate schedule and the Tier 3 (non-GCC expatriate) gratuity
 * policy. Not personal data about one employee, so unlike most HR groups this
 * one carries a single view/edit pair rather than a view/edit split per
 * sub-area — see `employeeGosiAccess.ts` on the server for the same reasoning.
 *
 * ── DEFAULT-DENY ON THE SERVER. NO `access` IS DECLARED HERE. ────────────────
 * Every action must be granted explicitly; an unset key is not a grant. See
 * features/employees/hr-privilege.ts and hr-privilege-contract.spec.ts. Filling
 * `access` in here would hand every existing privilege set the ability to read
 * and edit the company's GOSI rates on the very next load.
 *
 * The action strings are a contract with the API and are pinned on both sides
 * (hr-privilege-contract.spec.ts here, hrPrivilegeContract.test.ts on the
 * server — `employeeGosiAccess.ts`'s `GOSI_ACTIONS`). A misspelling produces a
 * grant that ticks on, saves, and denies every request.
 */
export function employeeGosiSecurity() {
  return new PrivilegeSetting({
    name: "Employee GOSI Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View GOSI Settings",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit GOSI Settings",
        securityType: "cloud",
      }),
    }
  });
}
