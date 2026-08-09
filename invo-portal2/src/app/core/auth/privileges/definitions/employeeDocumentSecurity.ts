import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee Document Security — identity documents and their expiry.
 *
 * Passports, visas, national IDs, licences and contracts, with expiry
 * reminders. `verify` is deliberately separate from `edit`: anyone holding
 * both could mark their own data entry as checked against the original,
 * which makes the flag meaningless.
 *
 * Downloads of these are audited server-side — a signed URL leaves the
 * system and can be forwarded.
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
export function employeeDocumentSecurity() {
  return new PrivilegeSetting({
    name: "Employee Document Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Employee Documents",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Add/Edit Employee Documents",
        securityType: "cloud",
      }),
      "verify": new PrivilegeSetting({
        name: "Verify Employee Documents",
        securityType: "cloud",
      }),
    }
  });
}
