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
];

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
        });
      });
    });
  }
});
