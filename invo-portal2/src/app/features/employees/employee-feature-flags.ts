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
export const HR_ASSETS = 'hr.assets';
export const HR_LEAVE = 'hr.leave';
export const HR_PERFORMANCE = 'hr.performance';
export const HR_DISCIPLINARY = 'hr.disciplinary';
export const HR_PAYROLL = 'hr.payroll';

/** Every HR key, for the tab strip and for tests that assert coverage. */
export const HR_FEATURE_KEYS = [
  HR_PROFILE, HR_DOCUMENTS, HR_ASSETS, HR_LEAVE,
  HR_PERFORMANCE, HR_DISCIPLINARY, HR_PAYROLL,
] as const;

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
 * Whether one HR module's tab may be rendered.
 *
 * ── EVERY MODULE HAS ITS OWN KEY ─────────────────────────────────────────────
 * Assets, leave, performance, disciplinary and payroll used to ride on
 * `hr.profile` because they had no key of their own. They have one now
 * (invoAdminProtal `FEATURE_GROUPS`), added before any company was switched on
 * so there was nothing to migrate.
 *
 * The two that most needed separating are payroll and disciplinary. A merchant
 * buying HR to track passport expiry has not thereby bought a screen showing
 * every salary in the company, and "HR is on" must never quietly mean
 * "disciplinary records are on".
 *
 * The dev override key follows the flag: `ff.hr.payroll`, not `ff.hr`. Any QA
 * note still saying `ff.hr` will appear to do nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function hrModuleEnabled(key: string): Signal<boolean> {
  const features = inject(FeatureService);
  const enabled = features.isEnabled$(key);
  return computed(() => enabled() || devOverride(key));
}

/** Whether the documents tab may be rendered. */
export function hrDocumentsEnabled(): Signal<boolean> {
  return hrModuleEnabled(HR_DOCUMENTS);
}
