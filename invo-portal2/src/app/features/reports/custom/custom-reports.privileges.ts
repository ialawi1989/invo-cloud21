import { PrivilegeSetting } from '@core/auth/privileges/models/privilege-setting.model';

/**
 * Custom Reports privilege group.
 *
 * Converted from the legacy `custom-reports.privileges.ts` to invo-portal2's
 * privilege model: a `PrivilegeSetting` factory registered in
 * `core/auth/privileges/models/privilege.model.ts` (the app's privilege tree),
 * with `PrivilegeService.check(fullKey)` doing the runtime gate. The backend's
 * `employee/getPrivilegesFile` payload supplies the actual access flags.
 */

export const customReportsSecurityGroup = {
  text: 'Custom Reports',
  key: 'customReportsSecurity',
};

export const customReportsEditPrivilege = { text: 'Edit Custom Reports (add / edit / view)', key: 'Edit' };
export const customReportsViewPrivilege = { text: 'View Custom Reports (read-only)', key: 'View' };

export const customReportsEditPrivilegeFullKey =
  customReportsSecurityGroup.key + '.actions.' + customReportsEditPrivilege.key + '.access';

export const customReportsViewPrivilegeFullKey =
  customReportsSecurityGroup.key + '.actions.' + customReportsViewPrivilege.key + '.access';

/** The privilege group, in the shape invo-portal2's tree expects. */
export function customReportsSecurity(): PrivilegeSetting {
  return new PrivilegeSetting({
    name: customReportsSecurityGroup.text,
    securityType: 'cloud',
    // Same sidebar category as reportsSecurity, so it sits beside it.
    securityGroup: 'reports',
    actions: {
      [customReportsEditPrivilege.key]: new PrivilegeSetting({
        name: customReportsEditPrivilege.text, securityType: 'cloud',
      }),
      [customReportsViewPrivilege.key]: new PrivilegeSetting({
        name: customReportsViewPrivilege.text, securityType: 'cloud',
      }),
    },
  });
}
