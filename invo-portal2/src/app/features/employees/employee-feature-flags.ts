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
 * The keys as they are stored in `Companies.features` and written by the admin
 * portal's HR master toggle (`invoAdminProtal`, core/models/company-features).
 *
 * Lowercase deliberately, and it must stay that way: that screen lowercases
 * every key on the way in and out, and `FeatureService.isEnabled()` matches
 * exactly — so an upper-case constant here could never be switched on.
 *
 * ── THERE IS NO BARE `hr` FALLBACK, ON PURPOSE ───────────────────────────────
 * `hr` was split into these two sub-keys before any company had it, and the
 * admin portal no longer writes the bare string. Accepting it here as well
 * would be the obvious "safe" move and is exactly what makes this class of
 * mismatch unresolvable: two spellings that both work mean nobody can tell
 * which is authoritative, and the dead one is never removed.
 *
 * That is the state promotions is in — 167 companies on the bare key, one on
 * sub-keys, and a portal gating on the string the admin screen stopped writing.
 * `hr` is enabled for no company, so there is nothing to be compatible with.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const HR_PROFILE = 'hr.profile';
export const HR_DOCUMENTS = 'hr.documents';

/**
 * @deprecated Use {@link HR_PROFILE}. Kept only so existing call sites keep
 * compiling; it now points at the sub-key, never at bare `hr`.
 */
export const EMPLOYEE_HR_FIELDS = HR_PROFILE;

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
  const enabled = features.isEnabled$(HR_PROFILE);
  return computed(() => enabled() || devOverride(HR_PROFILE));
}

/**
 * Whether the documents tab may be rendered.
 *
 * A separate grant from the profile cards: a merchant can run employee records
 * without ever storing identity documents, and the two are toggled
 * independently by the admin portal.
 *
 * Note the dev override key changed with the flag — it is now
 * `ff.hr.documents`, not `ff.hr`. Any QA note still saying `ff.hr` will appear
 * to do nothing.
 */
export function hrDocumentsEnabled(): Signal<boolean> {
  const features = inject(FeatureService);
  const enabled = features.isEnabled$(HR_DOCUMENTS);
  return computed(() => enabled() || devOverride(HR_DOCUMENTS));
}
