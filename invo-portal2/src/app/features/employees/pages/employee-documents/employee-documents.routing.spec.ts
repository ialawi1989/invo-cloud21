import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { EMPLOYEES_ROUTES } from '../../employees.routes';
import { hrPrivilegeGuard } from '../../hr-privilege';

/**
 * The documents route's gate.
 *
 * ── WHY THIS IS ASSERTED ON THE ROUTE TABLE ──────────────────────────────────
 * The tab strip is the primary control, and `visibleTabs` is already tested. The
 * route guard is the backstop for a typed or bookmarked URL, and it fails in a
 * way nobody notices: `privilegeGuard` — the portal's default guard, one word
 * away in an import — is default-ALLOW, so swapping it in admits everyone to
 * this route and the failure only shows as API refusals inside a screen that
 * loaded fine. Asserting the exact guard and the exact data catches that at
 * build time.
 *
 * The action strings are pinned here as literals on purpose. `view` is what the
 * server's `employeeDocumentSecurity` helper checks; a route asking for
 * `read`, or for `documentSecurity`, would deny everyone who holds the grant
 * and there is no error message anywhere that would say why.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const recordRoute = () => EMPLOYEES_ROUTES.find(r => r.path === ':id')!;

const childRoute = (path: string): Route | undefined =>
  recordRoute().children?.find(c => c.path === path);

describe('the documents child route', () => {
  it('is registered under the record shell', () => {
    // The tab is `ready: true` as of this commit. A ready tab with no route is
    // a dead link.
    expect(childRoute('documents')).toBeDefined();
  });

  it('leaves the profile as the default child at the record URL', () => {
    // `/employees/:id` must still render the form. Adding a sibling must not
    // displace it.
    expect(childRoute('')).toBeDefined();
  });

  it('guards with hrPrivilegeGuard, not the portal’s default-allow guard', () => {
    expect(childRoute('documents')!.canActivate).toEqual([hrPrivilegeGuard]);
  });

  it('asks for exactly the group and action the server checks', () => {
    expect(childRoute('documents')!.data).toEqual({
      hrGroup: 'employeeDocumentSecurity',
      hrAction: 'view',
    });
  });

  it('keeps the unsaved-changes guard on the profile child only', () => {
    // On the parent it would fire when switching tabs, which is not leaving the
    // record — prompting there is noise.
    expect(childRoute('')!.canDeactivate).toBeDefined();
    expect(childRoute('documents')!.canDeactivate).toBeUndefined();
    expect(recordRoute().canDeactivate).toBeUndefined();
  });
});
