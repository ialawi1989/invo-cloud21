import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee End of Service Security — the leaving workflow.
 *
 * Clearance, the final settlement, the exit interview, rehire eligibility and
 * the revocation of system access. Spec §4.11.
 *
 * ── `complete` IS SEPARATE FROM `edit`, DELIBERATELY ─────────────────────────
 * `edit` records the numbers. `complete` signs them off — and completion is the
 * irreversible step: it sets the employee's termination date and revokes their
 * access for this company. Whoever assembles a settlement is not necessarily
 * whoever may authorise paying it, and in most organisations that separation is
 * the control. A single grant covering both would mean the person entering a
 * laptop's return value can also end someone's employment record.
 *
 * ── DEFAULT-DENY ON THE SERVER. NO `access` IS DECLARED HERE. ────────────────
 * Every action must be granted explicitly; an unset key is not a grant. The
 * ABSENCE of `access` is what makes that work — see
 * features/employees/hr-privilege.ts and
 * core/auth/privileges/models/privilege-merge.spec.ts. Filling it with `true`
 * would hand every existing privilege set the ability to read settlements and
 * exit interviews on the very next load.
 *
 * The action strings are a contract with the API and are pinned on both sides
 * (hr-privilege-contract.spec.ts here, hrPrivilegeContract.test.ts on the
 * server). A misspelling produces a grant that ticks on, saves, and denies
 * every request. Renaming one silently revokes every grant already issued.
 */
export function employeeEosSecurity() {
  return new PrivilegeSetting({
    name: "Employee End of Service Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View End of Service",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit End of Service",
        securityType: "cloud",
      }),
      "complete": new PrivilegeSetting({
        name: "Complete End of Service and Settlement",
        securityType: "cloud",
      }),
    }
  });
}
