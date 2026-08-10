import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

/**
 * Explicit-grant privilege checks for the HR modules.
 *
 * ── WHY THIS EXISTS INSTEAD OF PrivilegeService.check() ──────────────────────
 * **Because the two default in opposite directions, and using the wrong one
 * shows every HR tab while every request inside it is refused.**
 *
 * `PrivilegeService.check()` is default-ALLOW. Its own comment says so: "only an
 * explicit `access === false` denies. Anything else … means not restricted."
 * That is right for the rest of the portal — adding a privilege group must not
 * lock people out of features they already reach.
 *
 * The HR API is default-DENY. Every HR access helper on the server uses
 * `hasExplicitPrivilege`, which requires `access === true`; an unset key is not
 * a grant. That is right for a gate over passports, salaries and disciplinary
 * records, where an unconfigured system must reveal less rather than more.
 *
 * Put those together with the portal's default and the result is the worst
 * available pairing:
 *
 *   • `check()` says allowed  → the tab renders for everyone
 *   • the API says denied     → every request inside it fails
 *
 * Visible and broken, rather than hidden. And it would not be caught in
 * testing: company admins and super admins bypass both sides, so whoever looks
 * first sees it working.
 *
 * ── DO NOT "TIDY UP" THE DUPLICATION ─────────────────────────────────────────
 * The obvious cleanup is to delete this file and call `check()`. The
 * second-most obvious is to change `check()` to default-deny. Both are wrong:
 *
 *   • Using `check()` for HR reintroduces the pairing above.
 *   • Changing `check()`'s default silently revokes access to every other
 *     feature in the portal for every user whose privilege record does not
 *     explicitly grant it — which is most of them, since the semantics have
 *     always been default-allow. There would be no way to tell who was
 *     affected until they complained.
 *
 * This note is repeated here rather than cross-referenced for the same reason
 * the server repeats it in each access helper: whoever comes to "fix" the
 * duplication will be reading this file, not the other one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Does the signed-in user hold an explicit grant?
 *
 * Mirrors the server's `hasExplicitPrivilege`: the action's `access` must be
 * exactly `true`. Absent, null or `false` all mean no.
 *
 * @param group  e.g. `employeeDocumentSecurity`
 * @param action e.g. `view` — spelled exactly as the API checks it. The strings
 *               are pinned on both sides; see hr-privilege-contract.spec.ts.
 */
export function hasHrGrant(
  privileges: any,
  group: string,
  action: string,
): boolean {
  return privileges?.[group]?.actions?.[action]?.access === true;
}

/**
 * Whether the signed-in user may reach an HR area.
 *
 * Admins and super admins bypass, exactly as the server does — `isAdmin` short
 * -circuits `hasExplicitPrivilege` in every access helper. Mirrored here so the
 * UI an admin sees matches what the API will actually allow them.
 *
 * **That bypass is also what hides a broken gate**, so anyone testing this
 * should sign in as a non-admin with a known grant, not as an admin.
 */
export function hrGrant(group: string, action: string): boolean {
  return hrGrantFor(inject(PrivilegeService), inject(AuthService), group, action);
}

/**
 * The same decision, for a caller that already holds the services.
 *
 * The admin test follows the portal's established pattern (see
 * `dashboard.component.ts`): `currentEmployee.superAdmin`, or the absence of a
 * privileges payload — super admins arrive without one. `admin` is included
 * too, because the server bypasses on `admin || superAdmin`, and a UI that
 * hid a tab the API would have allowed is its own kind of wrong.
 */
export function hrGrantFor(
  privilegeService: PrivilegeService,
  auth: AuthService,
  group: string,
  action: string,
): boolean {
  const employee: any = auth.currentEmployee;
  if (employee?.superAdmin === true || employee?.admin === true) return true;

  const privileges = privilegeService.privileges;
  // No payload at all means a super admin, who bypasses server-side. Matching
  // that here keeps the UI and the API agreeing about the same person.
  if (!privileges) return true;

  return hasHrGrant(privileges, group, action);
}

/**
 * Is the record being viewed the signed-in employee's own?
 *
 * The `:id` lives on the PARENT route — HR tabs are children of
 * `/employees/:id` — so the parent is checked first and the route's own params
 * only as a fallback.
 */
export function isOwnRecord(route: { paramMap: any; parent?: any }, auth: AuthService): boolean {
  const id = route.parent?.paramMap?.get('id') ?? route.paramMap?.get('id') ?? null;
  const me = (auth.currentEmployee as any)?.id ?? null;
  return !!id && !!me && String(id) === String(me);
}

/**
 * Route guard for HR areas.
 *
 * Route data:
 *   hrGroup       — e.g. `employeeDocumentSecurity`
 *   hrAction      — e.g. `view`
 *   hrSelfAllowed — optional; the subject reaches their own record without any
 *                   grant. See below.
 *
 * Deliberately NOT `privilegeGuard`, which would admit everyone. On denial the
 * user is returned to the employee record rather than sent to `/403`: they got
 * here from a tab, and a tab they may not open should not exist for them — the
 * guard is the backstop for a typed URL, not the primary control.
 *
 * ── WHY hrSelfAllowed EXISTS ─────────────────────────────────────────────────
 * Leave is the one module where the subject is the normal author: the server
 * admits them on `isSelf(callerId, employeeId)` with no privilege at all. A
 * guard requiring `employeeLeaveSecurity.view` would lock every employee out of
 * their own leave — the exact people the module is for — while the API would
 * have served them perfectly happily.
 *
 * It is opt-in per route rather than blanket, because it is emphatically NOT
 * true of the other modules. Someone reading their own disciplinary record
 * before the meeting, or their own performance calibration, is a different
 * question with a different answer, and the server does not grant it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const hrPrivilegeGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const privileges = inject(PrivilegeService);
  const auth = inject(AuthService);

  const group: string | undefined = route.data['hrGroup'];
  const action: string | undefined = route.data['hrAction'];
  if (!group || !action) return false;

  if (route.data['hrSelfAllowed'] === true && isOwnRecord(route, auth)) return true;

  if (hrGrantFor(privileges, auth, group, action)) return true;

  const employeeId = route.parent?.paramMap.get('id') ?? route.paramMap.get('id');
  router.navigate(employeeId ? ['/employees', employeeId] : ['/employees']);
  return false;
};
