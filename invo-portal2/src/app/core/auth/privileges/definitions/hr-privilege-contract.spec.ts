import { describe, expect, it } from 'vitest';
import { employeeAssetSecurity } from './employeeAssetSecurity';
import { employeeEosSecurity } from './employeeEosSecurity';
import { employeeDisciplinarySecurity } from './employeeDisciplinarySecurity';
import { employeeDocumentSecurity } from './employeeDocumentSecurity';
import { employeeLeaveSecurity } from './employeeLeaveSecurity';
import { employeePayrollSecurity } from './employeePayrollSecurity';
import { employeePerformanceSecurity } from './employeePerformanceSecurity';
import { employeeProfileSecurity } from './employeeProfileSecurity';
import { hasHrGrant } from '../../../../features/employees/hr-privilege';

/**
 * The HR privilege strings, pinned character by character against the API.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * These action keys are a contract with the backend, which checks them with
 * `hasExplicitPrivilege(privileges, group, action)`. The two live in separate
 * repositories with no shared package, so nothing but a test on each side stops
 * them drifting.
 *
 * The failure if they drift is silent and expensive. A definition here saying
 * `decide_appeal` where the API checks `decideAppeal` produces a grant that
 * appears in the privilege form, ticks on, saves successfully — and denies
 * every request. Nothing errors; the feature simply does not work for whoever
 * was granted it. That is the same shape as the `handoverTo` /
 * `handoverToEmployeeId` divergence.
 *
 * **The mirror of this list lives on the server** at
 * `InvoCloudBack/src/repo/admin/hrPrivilegeContract.test.ts`, asserted against
 * the access helpers themselves. Changing an action string means changing it in
 * three places, and missing one breaks a test on that side.
 *
 * Renaming an action is not a refactor: grants are stored data keyed on these
 * strings, so a rename silently revokes every grant already issued.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Exactly what the API checks. Copied from the server's access helpers. */
const CONTRACT: Record<string, string[]> = {
  employeeProfileSecurity: ['viewSensitive'],
  employeeDocumentSecurity: ['view', 'edit', 'verify'],
  employeeAssetSecurity: ['view', 'edit'],
  employeeEosSecurity: ['view', 'edit', 'complete'],
  employeeDisciplinarySecurity: ['view', 'edit', 'decideAppeal'],
  employeePerformanceSecurity: ['view', 'edit', 'calibrate'],
  employeeLeaveSecurity: ['view', 'edit', 'approve'],
  employeePayrollSecurity: ['viewPay', 'editPay', 'viewBank', 'editBank'],
};

const DEFINITIONS: Record<string, () => any> = {
  employeeProfileSecurity,
  employeeDocumentSecurity,
  employeeAssetSecurity,
  employeeDisciplinarySecurity,
  employeePerformanceSecurity,
  employeeLeaveSecurity,
  employeePayrollSecurity,
  employeeEosSecurity,
};

describe('HR privilege contract', () => {
  it('declares every group the API checks', () => {
    expect(Object.keys(DEFINITIONS).sort()).toEqual(Object.keys(CONTRACT).sort());
  });

  Object.entries(CONTRACT).forEach(([group, expectedActions]) => {
    it(`${group} declares exactly the actions the API checks`, () => {
      const declared = Object.keys(DEFINITIONS[group]().actions ?? {});

      // `employeeProfileSecurity` predates this work and also carries `view`
      // and `add`, which the portal uses for its own gating. Only the actions
      // the API checks are pinned; extra portal-only actions are allowed.
      const missing = expectedActions.filter(a => !declared.includes(a));

      expect({
        group,
        missingFromDefinition: missing,
        why:
          'The API checks these exact strings. One missing or misspelled here ' +
          'produces a grant that ticks on, saves, and denies every request.',
      }).toEqual({ group, missingFromDefinition: [], why: expect.anything() });
    });
  });

  it('uses no separator a hand-written definition might spell differently', () => {
    // The realistic mistake is decide_appeal or decide-appeal.
    for (const actions of Object.values(CONTRACT)) {
      for (const action of actions) {
        expect(action).toMatch(/^[a-z][A-Za-z]*$/);
      }
    }
  });
});

describe('hasHrGrant — explicit grant only', () => {
  // Mirrors the server's hasExplicitPrivilege. The portal's own
  // PrivilegeService.check() is default-ALLOW and must NOT be used for these;
  // see features/employees/hr-privilege.ts for the full reasoning.

  it('grants only when access is exactly true', () => {
    const privileges = { employeeDocumentSecurity: { actions: { view: { access: true } } } };
    expect(hasHrGrant(privileges, 'employeeDocumentSecurity', 'view')).toBe(true);
  });

  it('denies an unset action — the difference from check()', () => {
    // check() would return true here, show the tab, and every request inside
    // it would be refused by the API.
    expect(hasHrGrant({}, 'employeeDocumentSecurity', 'view')).toBe(false);
    expect(hasHrGrant({ employeeDocumentSecurity: {} }, 'employeeDocumentSecurity', 'view')).toBe(false);
    expect(hasHrGrant({ employeeDocumentSecurity: { actions: {} } }, 'employeeDocumentSecurity', 'view')).toBe(false);
  });

  it('denies an explicit false', () => {
    const privileges = { employeeDocumentSecurity: { actions: { view: { access: false } } } };
    expect(hasHrGrant(privileges, 'employeeDocumentSecurity', 'view')).toBe(false);
  });

  it('denies a truthy-but-not-true value', () => {
    // `access: 1` or `access: 'true'` from a loosely-typed payload must not
    // pass where the server requires === true.
    expect(hasHrGrant({ g: { actions: { a: { access: 1 } } } }, 'g', 'a')).toBe(false);
    expect(hasHrGrant({ g: { actions: { a: { access: 'true' } } } }, 'g', 'a')).toBe(false);
  });

  it('denies when there are no privileges at all', () => {
    expect(hasHrGrant(null, 'employeeDocumentSecurity', 'view')).toBe(false);
    expect(hasHrGrant(undefined, 'employeeDocumentSecurity', 'view')).toBe(false);
  });
});
