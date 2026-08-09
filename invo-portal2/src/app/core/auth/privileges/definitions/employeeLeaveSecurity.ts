import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Employee Leave Security — entitlements, requests and approval.
 *
 * The one HR module where the employee is the normal author: they create and
 * cancel their own requests without a grant. `approve` is separate from
 * `edit`, and nobody may approve their own request — the server refuses it
 * outright, which is the case no privilege split can catch.
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
export function employeeLeaveSecurity() {
  return new PrivilegeSetting({
    name: "Employee Leave Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Leave and Balances",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit Leave Entitlements and Requests",
        securityType: "cloud",
      }),
      "approve": new PrivilegeSetting({
        name: "Approve or Reject Leave",
        securityType: "cloud",
      }),
    }
  });
}
