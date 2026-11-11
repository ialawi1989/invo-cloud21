/** An employee earnings feature a company switches on in the commission settings. */
export type EmployeeEarningsFeature = 'commission' | 'tips';

/**
 * Whether the company has switched on any of the given earnings features
 * (`employeeCommissionOptions.enabled` / `employeeTipOptions.enabled`).
 * Never-configured options count as off.
 */
export function isEmployeeEarningsEnabled(
  company: { employeeCommissionOptions?: { enabled?: boolean } | null; employeeTipOptions?: { enabled?: boolean } | null } | null | undefined,
  features: EmployeeEarningsFeature | EmployeeEarningsFeature[],
): boolean {
  return ([] as EmployeeEarningsFeature[]).concat(features).some(feature =>
    feature === 'commission'
      ? !!company?.employeeCommissionOptions?.enabled
      : !!company?.employeeTipOptions?.enabled,
  );
}

/**
 * The body for `company/saveCompany`. The employee earnings settings (commission and tips) have their own
 * page; every other save sends null for both, which the server treats as "keep the stored value"
 * (`COALESCE($n, column)`), so a page holding an older copy of the company can't revert them.
 */
export function companySavePayload<T extends object>(company: T, includeEarningsOptions = false): T {
  return includeEarningsOptions
    ? company
    : { ...company, employeeCommissionOptions: null, employeeTipOptions: null };
}
