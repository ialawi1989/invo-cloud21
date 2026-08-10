import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { EMPLOYEES_ROUTES } from './employees.routes';
import { hrPrivilegeGuard } from './hr-privilege';

/**
 * The HR tab routes and their gates.
 *
 * ── WHY THIS IS ASSERTED ON THE ROUTE TABLE ──────────────────────────────────
 * The tab strip is the primary control, and `visibleTabs` is already tested. The
 * route guard is the backstop for a typed or bookmarked URL, and it fails in a
 * way nobody notices: `privilegeGuard` — the portal's default guard, already
 * imported into this very file for the non-HR routes — is default-ALLOW, so
 * swapping it in admits everyone and the failure only shows as API refusals
 * inside a screen that loaded fine. Asserting the exact guard catches that at
 * build time.
 *
 * The group and action strings are pinned as literals on purpose. They are
 * spelled exactly as the server's access helpers check them; a route asking for
 * `read` instead of `view`, or for `assetSecurity` instead of
 * `employeeAssetSecurity`, would deny everyone who holds the grant, and there
 * is no error message anywhere that would say why.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const recordRoute = () => EMPLOYEES_ROUTES.find(r => r.path === ':id')!;

const childRoute = (path: string): Route | undefined =>
  recordRoute().children?.find(c => c.path === path);

/** Every HR tab route, and the grant the server checks for it. */
const HR_TABS = [
  { path: 'documents', hrGroup: 'employeeDocumentSecurity', hrAction: 'view' },
  { path: 'assets', hrGroup: 'employeeAssetSecurity', hrAction: 'view' },
  { path: 'leave', hrGroup: 'employeeLeaveSecurity', hrAction: 'view', hrSelfAllowed: true },
  { path: 'performance', hrGroup: 'employeePerformanceSecurity', hrAction: 'view' },
  { path: 'disciplinary', hrGroup: 'employeeDisciplinarySecurity', hrAction: 'view', hrSelfAllowed: true },
  // viewPay, not view. Payroll's grants are named differently because pay and
  // bank details are separate; asking for `view` would deny everyone who holds
  // the grant, with no error anywhere saying why.
  { path: 'payroll', hrGroup: 'employeePayrollSecurity', hrAction: 'viewPay' },
];

/**
 * Routes where the SUBJECT reaches their own record without any grant.
 *
 * Written out as a literal, not derived from HR_TABS, so adding one is a
 * deliberate edit here rather than a side effect of editing the table above.
 * Each entry needs its own justification from the server:
 *
 *   leave         the subject is the AUTHOR — the controller falls back to
 *                 `isSelf` on create and edit. Gating on the grant would hide
 *                 leave from every employee it is for.
 *   disciplinary  the subject is only a READER, but `mayRead` opens with
 *                 `if (isSelf(...)) return true`: a warning nobody may show the
 *                 employee is not a warning. Everything else on that tab —
 *                 editing, acknowledging, and the escalation figure — is still
 *                 withheld from them.
 *
 * It is NOT true of documents, assets or performance. Reading your own
 * passport scan, your own asset list or your own calibration are three
 * different questions and the server answers all three with the grant.
 */
const SELF_ALLOWED_PATHS = ['leave', 'disciplinary'];

describe('the HR tab routes', () => {
  it('leaves the profile as the default child at the record URL', () => {
    // `/employees/:id` must still render the form. Adding siblings must not
    // displace it — every existing link and bookmark points there.
    expect(childRoute('')).toBeDefined();
  });

  it('keeps the unsaved-changes guard on the profile child only', () => {
    // On the parent it would fire when switching tabs, which is not leaving the
    // record — prompting there is noise.
    expect(childRoute('')!.canDeactivate).toBeDefined();
    expect(recordRoute().canDeactivate).toBeUndefined();
    for (const tab of HR_TABS) {
      expect(childRoute(tab.path)!.canDeactivate).toBeUndefined();
    }
  });

  for (const tab of HR_TABS) {
    describe(`/${tab.path}`, () => {
      it('is registered under the record shell', () => {
        // Its tab is `ready: true`, and a ready tab with no route is a dead link.
        expect(childRoute(tab.path)).toBeDefined();
      });

      it('guards with hrPrivilegeGuard, not the portal’s default-allow guard', () => {
        expect(childRoute(tab.path)!.canActivate).toEqual([hrPrivilegeGuard]);
      });

      it('asks for exactly the group and action the server checks', () => {
        expect(childRoute(tab.path)!.data).toEqual({
          hrGroup: tab.hrGroup,
          hrAction: tab.hrAction,
          ...(tab.hrSelfAllowed ? { hrSelfAllowed: true } : {}),
        });
      });
    });
  }

  /**
   * The self escape hatch, asserted as an exception rather than a feature.
   *
   * `hrSelfAllowed` waives the GRANT for the subject of the record — never the
   * feature flag, and never anything beyond reading. Two routes carry it and
   * both are justified against the server above; the flag is exactly the kind
   * that spreads by copy-paste, so any third route trips this.
   */
  it('waives the grant for the subject on only the routes that justify it', () => {
    const waived = recordRoute().children!
      .filter(c => c.data?.['hrSelfAllowed'] === true)
      .map(c => c.path);
    expect(waived).toEqual(SELF_ALLOWED_PATHS);
  });
});
