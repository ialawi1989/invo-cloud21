import { describe, expect, it } from 'vitest';

import { Privilege } from './privilege.model';
import { PrivilegeSetting } from './privilege-setting.model';
import { SECURITY_DEFINITIONS } from '../definitions/registry';
import { hasPrivilegeAccess } from '../privilege.service';
import { hasHrGrant } from '../../../../features/employees/hr-privilege';

/**
 * Loading a privilege set saved before a group existed.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────────
 * A saved record is stored as-is, so a set written before the HR groups shipped
 * contains no `employeeDocumentSecurity` key at all. Every read path rebuilds
 * the tree with `new Privilege()` — which seeds every group from
 * SECURITY_DEFINITIONS — and then overlays the saved JSON. **The registry is
 * the skeleton and the saved JSON is the overlay**, so a group added since the
 * record was saved appears with its declared shape, and a group dropped from
 * the registry falls out instead of lingering.
 *
 * That behaviour already existed; these tests exist because nothing pinned it,
 * and the one thing that must never change about it is the value a merged-in
 * group carries.
 *
 * ── THE VALUE THAT MUST STAY ABSENT ──────────────────────────────────────────
 * The definitions declare no `access` at all — only `name` and `securityType` —
 * and `PrivilegeSetting` initialises it to `null`. That omission is
 * load-bearing in two opposite directions at once:
 *
 *   • rest of the portal — `check()` denies only on an explicit `false`, so a
 *     merged-in group is ALLOWED and nobody loses access they already had
 *   • HR — `hasHrGrant` requires exactly `true`, so a merged-in group is
 *     DENIED until an administrator ticks it
 *
 * Filling the gap with `true` would hand every existing privilege set the
 * ability to read passports, salaries, bank details and disciplinary records on
 * the next load. Filling it with `false` would lock every existing user out of
 * every non-HR feature merged in this way. **The safe default is the absence.**
 * Cases 4 and 5 below pull in opposite directions from that same absent value:
 * any concrete default satisfies one and breaks the other.
 */

/** A saved payload from before the HR groups existed — the real shape. */
function legacySavedJson(): any {
  return {
    // A group with a real grant, to prove the overlay wins where it speaks.
    invoiceSecurity: {
      name: 'Invoice Security',
      access: true,
      securityType: 'cloud',
      actions: {
        view: { name: 'View Invoice', access: true, securityType: 'cloud' },
        add: { name: 'Add Invoice', access: false, securityType: 'cloud' },
      },
    },
    // A group explicitly denied, which must stay denied.
    taxSecurity: {
      name: 'Tax Security',
      access: false,
      securityType: 'cloud',
    },
    // NOTE: no employeeDocumentSecurity / employeeAssetSecurity / … at all.
    // That absence is the whole point of the fixture.
  };
}

const HR_GROUPS = [
  'employeeDocumentSecurity',
  'employeeAssetSecurity',
  'employeeLeaveSecurity',
  'employeePerformanceSecurity',
  'employeeDisciplinarySecurity',
  'employeePayrollSecurity',
];

function load(json: any): Privilege {
  const p = new Privilege();
  p.ParseJson(json);
  return p;
}

describe('privilege merge — a set saved before a group existed', () => {
  // ── Case 1 ────────────────────────────────────────────────────────────────
  it('gains every registry group the saved JSON never had, UNGRANTED', () => {
    const merged = load(legacySavedJson());

    for (const group of HR_GROUPS) {
      const section = merged[group] as PrivilegeSetting;
      expect(section, `${group} should be merged in from the registry`).toBeTruthy();
      expect(section.name.length, `${group} should carry its declared name`).toBeGreaterThan(0);

      // The assertion the "default to true" mutant must redden on. Written as
      // `not.toBe(true)` rather than `toBeNull()` so it fails on the value that
      // matters — a grant — rather than on the representation of its absence.
      expect(section.access, `${group}.access must not be a grant`).not.toBe(true);
      for (const key in section.actions ?? {}) {
        expect(
          section.actions![key].access,
          `${group}.${key} must not be granted by merely being merged in`,
        ).not.toBe(true);
      }
    }
  });

  it('merges in the HR actions themselves, so they can be ticked', () => {
    // Case 1's inverse in spirit: the group appearing but empty would satisfy
    // "ungranted" while leaving nothing for an administrator to grant.
    const merged = load(legacySavedJson());
    const docs = merged['employeeDocumentSecurity'] as PrivilegeSetting;

    expect(Object.keys(docs.actions ?? {})).toEqual(['view', 'edit', 'verify']);
  });

  // ── Case 2 ────────────────────────────────────────────────────────────────
  it('leaves the saved grants exactly as they were', () => {
    const merged = load(legacySavedJson());
    const invoice = merged['invoiceSecurity'] as PrivilegeSetting;
    const tax = merged['taxSecurity'] as PrivilegeSetting;

    // The registry must not overwrite what the record says. The mutant that
    // lets the skeleton win reddens here.
    expect(invoice.access).toBe(true);
    expect(invoice.actions!['view'].access).toBe(true);
    expect(invoice.actions!['add'].access).toBe(false);
    expect(tax.access).toBe(false);
  });

  it('keeps an explicit false as false, not as an absence', () => {
    // `false` and `null` are the same to hasHrGrant and different to check(),
    // so collapsing one into the other is invisible on the HR side and grants
    // access on the other. Pinned separately for that reason.
    const merged = load(legacySavedJson());

    expect((merged['taxSecurity'] as PrivilegeSetting).access).toBe(false);
    expect((merged['taxSecurity'] as PrivilegeSetting).access).not.toBeNull();
  });

  // ── Case 3 ────────────────────────────────────────────────────────────────
  it('drops a group that is in the saved JSON but no longer in the registry', () => {
    const json = legacySavedJson();
    json['retiredFeatureSecurity'] = {
      name: 'Retired Feature',
      access: true,
      securityType: 'cloud',
      actions: { view: { name: 'View', access: true } },
    };

    const merged = load(json);

    expect(merged['retiredFeatureSecurity']).toBeUndefined();
    // And it must not survive a round-trip either — a dropped group that comes
    // back on save is not dropped.
    expect(merged.ToJson()['retiredFeatureSecurity']).toBeUndefined();
  });

  it('drops an action the registry no longer declares, and surfaces the new one', () => {
    // A renamed action is a removal plus an addition. The definition files warn
    // that a rename silently revokes every grant already issued; this pins that
    // the old grant does not survive under the new name, which would be worse —
    // an administrator would see a tick nobody set.
    const json = legacySavedJson();
    json['employeeDocumentSecurity'] = {
      name: 'Employee Document Security',
      access: true,
      securityType: 'cloud',
      actions: {
        // `view` is real; `inspect` is a stand-in for an action since renamed.
        view: { name: 'View Employee Documents', access: true },
        inspect: { name: 'Inspect Employee Documents', access: true },
      },
    };

    const merged = load(json);
    const docs = merged['employeeDocumentSecurity'] as PrivilegeSetting;

    expect(docs.actions!['inspect']).toBeUndefined();
    expect(docs.actions!['view'].access).toBe(true);
    // The actions that exist now but were never in the record arrive unticked,
    // visible to whoever opens the form rather than silently pre-granted.
    expect(docs.actions!['edit'].access).not.toBe(true);
    expect(docs.actions!['verify'].access).not.toBe(true);
  });

  // ── Case 4 — non-HR semantics: absence means ALLOWED ───────────────────────
  it('a merged-in NON-HR group is still allowed by the default-allow check', () => {
    const merged = load(legacySavedJson());
    const tree = merged.ToJson();

    // `productSecurity` is in the registry and absent from the fixture, so it
    // is merged in. Nobody may lose access to it by that merge alone.
    expect(tree['productSecurity']).toBeTruthy();
    expect(hasPrivilegeAccess(tree, 'productSecurity.access')).toBe(true);
    expect(hasPrivilegeAccess(tree, 'productSecurity.actions.view.access')).toBe(true);
  });

  it('an explicitly denied group is still denied by the same check', () => {
    // The inverse of case 4: a check that answered `true` unconditionally would
    // satisfy the test above and fail here.
    const tree = load(legacySavedJson()).ToJson();

    expect(hasPrivilegeAccess(tree, 'taxSecurity.access')).toBe(false);
    expect(hasPrivilegeAccess(tree, 'invoiceSecurity.actions.add.access')).toBe(false);
  });

  // ── Case 5 — HR semantics: the same absence means DENIED ───────────────────
  it('a merged-in HR group is denied by the explicit-grant check', () => {
    const tree = load(legacySavedJson()).ToJson();

    for (const group of HR_GROUPS) {
      for (const action of Object.keys(tree[group].actions ?? {})) {
        expect(
          hasHrGrant(tree, group, action),
          `${group}.${action} must not be granted by the merge`,
        ).toBe(false);
      }
    }
  });

  it('an HR group IS granted once its action is ticked', () => {
    // Case 5's inverse: a hasHrGrant that returned false unconditionally would
    // satisfy the test above. This also pins that the merged shape is grantable
    // at all — the entire point of making the groups visible in the form.
    const merged = load(legacySavedJson());
    (merged['employeeDocumentSecurity'] as PrivilegeSetting).actions!['view'].access = true;
    const tree = merged.ToJson();

    expect(hasHrGrant(tree, 'employeeDocumentSecurity', 'view')).toBe(true);
    expect(hasHrGrant(tree, 'employeeDocumentSecurity', 'edit')).toBe(false);
  });

  // ── Open-and-save must not change anyone's access ─────────────────────────
  it('opening a set and saving it unchanged grants nothing new', () => {
    const saved = legacySavedJson();
    const firstLoad = load(saved);
    const written = firstLoad.ToJson();

    // Everything the original record actually said is unchanged.
    expect(written['invoiceSecurity'].access).toBe(true);
    expect(written['invoiceSecurity'].actions.view.access).toBe(true);
    expect(written['invoiceSecurity'].actions.add.access).toBe(false);
    expect(written['taxSecurity'].access).toBe(false);

    // Nothing anywhere in the written tree is a grant that the saved record did
    // not already carry. This is the assertion that would catch a merge which
    // defaulted anything to true, in any group, not just the ones listed above.
    const grantsIn = (tree: any): string[] => {
      const out: string[] = [];
      for (const key of Object.keys(tree)) {
        if (tree[key]?.access === true) out.push(`${key}.access`);
        for (const ak of Object.keys(tree[key]?.actions ?? {})) {
          if (tree[key].actions[ak]?.access === true) out.push(`${key}.${ak}`);
        }
      }
      return out.sort();
    };
    expect(grantsIn(written)).toEqual(['invoiceSecurity.access', 'invoiceSecurity.view']);

    // And re-loading what was written is stable — a merge that grew or lost
    // grants on each round-trip would drift a record every time it was opened.
    expect(grantsIn(load(written).ToJson())).toEqual(grantsIn(written));
  });

  it('every registry group survives the round-trip', () => {
    // Guards the other direction of the round-trip: a save that wrote only the
    // groups the record already had would re-create the original problem.
    const written = load(legacySavedJson()).ToJson();

    expect(Object.keys(written).sort()).toEqual(Object.keys(SECURITY_DEFINITIONS).sort());
  });
});
