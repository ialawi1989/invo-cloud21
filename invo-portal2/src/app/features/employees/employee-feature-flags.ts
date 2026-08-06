/**
 * Employee feature flags.
 *
 * `EMPLOYEE_HR_FIELDS` gates the manifest-driven Personal / Employment cards.
 *
 * It is **off until the backend can store what those cards collect**. Today
 * `saveEmployee` inserts and updates a fixed column list and `getEmployeeById`
 * selects a fixed column list, so a `profile` / `employment` group posted with
 * the record is accepted, answered with a success toast, and dropped. Showing
 * the fields before the columns exist means HR types a person's dependants in
 * and is told it saved. Turn this on in the same release as the jsonb columns.
 *
 * The flag is server-driven — `CompanyService` hydrates `FeatureService` from
 * the company payload — so enabling it is a backend change, not a redeploy.
 * Outside production a `localStorage` override exists so the UI can be worked
 * on and QA'd before that: `localStorage.setItem('ff.hr','1')`.
 */

import { Signal, computed, inject } from '@angular/core';

import { FeatureService } from '@core/auth/feature.service';
import { environment } from '../../../environments/environment';

/**
 * The key as it is stored in `Companies.features` and toggled by the admin
 * portal's Manage Features grid (`invoAdminProtal`, pages/manage-features).
 *
 * Lowercase deliberately, and it must stay that way: that grid lowercases every
 * key on the way in and out, and `FeatureService.isEnabled()` matches exactly —
 * so an upper-case constant here could never be switched on by anyone.
 *
 * The symbol keeps its descriptive name so call sites read clearly; only the
 * wire value is `'hr'`. When later HR phases arrive they are expected to become
 * sub-features (`hr.documents`, `hr.payroll`) under an HR group, the way
 * promotions did — at which point this becomes the master key.
 */
export const EMPLOYEE_HR_FIELDS = 'hr';

/** Local-only override, ignored in production. */
function devOverride(flag: string): boolean {
  if (environment.production) return false;
  try {
    return localStorage.getItem(`ff.${flag}`) === '1';
  } catch {
    // Private mode / storage disabled — no override, which is the safe answer.
    return false;
  }
}

/**
 * Whether the HR field groups may be rendered. Call from an injection context;
 * the result is reactive, so the cards appear as soon as the company payload
 * hydrates the flag — no reload needed.
 */
export function hrFieldsEnabled(): Signal<boolean> {
  const features = inject(FeatureService);
  const enabled = features.isEnabled$(EMPLOYEE_HR_FIELDS);
  return computed(() => enabled() || devOverride(EMPLOYEE_HR_FIELDS));
}
