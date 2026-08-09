import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee Asset Security — company property issued to an employee.
 *
 * Laptops, phones, ID cards, keys and vehicles, with handover condition and
 * expected return. An employee can always read their own assignments
 * without a grant — they are entitled to know what they are said to hold —
 * but never edit them: marking your own laptop returned would clear the
 * end-of-service gate without anyone seeing the item.
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
export function employeeAssetSecurity() {
  return new PrivilegeSetting({
    name: "Employee Asset Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Employee Assets",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Issue/Return Employee Assets",
        securityType: "cloud",
      }),
    }
  });
}
