import { describe, expect, it } from 'vitest';

import { AssetStatusDescriptor } from '../../services/employee-asset.service';
import { isOpenStatus, returnFieldsMode } from './asset-return-rules';

/**
 * The conditional-validation rule.
 *
 * ── WHY THIS IS TESTED AGAINST A FIXTURE, NOT A HARDCODED LIST ───────────────
 * The whole point of this module is that it reads `expectsReturn` from the
 * server's catalogue rather than knowing which statuses are which. So the
 * fixture below is a *copy of the server's list* used as input data, and the
 * last test in this file feeds it a status that does not exist on the server at
 * all — if the implementation ever starts matching on status NAMES, that test
 * is the one that fails.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Copied verbatim from the server's ASSET_STATUSES. */
const STATUSES: AssetStatusDescriptor[] = [
  { key: 'Assigned', labelKey: 'employees.assets.status.assigned', closesAssignment: false, expectsReturn: false },
  { key: 'Returned', labelKey: 'employees.assets.status.returned', closesAssignment: true, expectsReturn: true },
  { key: 'Damaged', labelKey: 'employees.assets.status.damaged', closesAssignment: true, expectsReturn: true },
  { key: 'Lost', labelKey: 'employees.assets.status.lost', closesAssignment: true, expectsReturn: false },
  { key: 'WrittenOff', labelKey: 'employees.assets.status.writtenOff', closesAssignment: true, expectsReturn: false },
];

describe('returnFieldsMode', () => {
  it('requires the return pair for a status that expects the item back', () => {
    // The item came back and someone looked at it, so both are recordable and
    // the server refuses the save without them.
    expect(returnFieldsMode('Returned', STATUSES)).toBe('required');
    expect(returnFieldsMode('Damaged', STATUSES)).toBe('required');
  });

  it('forbids the return pair for a status that does not', () => {
    // Recording the condition of a laptop nobody ever saw again is a fiction,
    // and Lost is exactly where someone would tick "Good" to clear the form.
    expect(returnFieldsMode('Lost', STATUSES)).toBe('forbidden');
    expect(returnFieldsMode('WrittenOff', STATUSES)).toBe('forbidden');
  });

  it('forbids them while the item is still out', () => {
    // Assigned has not come back, so there is nothing to date or inspect.
    expect(returnFieldsMode('Assigned', STATUSES)).toBe('forbidden');
  });

  /**
   * The decision worth stating: a portal that cannot read the rule does not
   * invent one.
   *
   * `unknown` enforces nothing and lets the request through, so the server
   * gives the real answer. Returning `forbidden` here would look safer and be
   * worse — it would clear a return date the user typed, on a status that
   * requires it, and then the save would fail for a field no longer on screen.
   */
  it('says unknown rather than guessing when the catalogue is missing', () => {
    expect(returnFieldsMode('Returned', [])).toBe('unknown');
    expect(returnFieldsMode(null, STATUSES)).toBe('unknown');
    expect(returnFieldsMode(undefined, STATUSES)).toBe('unknown');
  });

  it('says unknown for a status the catalogue does not carry', () => {
    // A status added on the server before the portal is redeployed.
    expect(returnFieldsMode('Recycled', STATUSES)).toBe('unknown');
  });

  /**
   * THE ONE THAT CATCHES A HARDCODED LIST.
   *
   * A status the server has never had, flagged `expectsReturn: true`. Only an
   * implementation that actually reads the flag can get this right — one that
   * matches on names would call it unknown, or forbidden.
   */
  it('follows the flag, not the status name', () => {
    const invented: AssetStatusDescriptor[] = [
      { key: 'SentForRepair', labelKey: 'x', closesAssignment: true, expectsReturn: true },
      { key: 'Returned', labelKey: 'y', closesAssignment: true, expectsReturn: false },
    ];
    expect(returnFieldsMode('SentForRepair', invented)).toBe('required');
    // And the same list with Returned's flag flipped must flip the answer,
    // which no name-matching implementation would do.
    expect(returnFieldsMode('Returned', invented)).toBe('forbidden');
  });
});

describe('isOpenStatus', () => {
  it('reads closesAssignment, which is what EOS clearance keys on', () => {
    expect(isOpenStatus('Assigned', STATUSES)).toBe(true);
    expect(isOpenStatus('Returned', STATUSES)).toBe(false);
    expect(isOpenStatus('Lost', STATUSES)).toBe(false);
  });

  it('returns null rather than false when it cannot tell', () => {
    // False would claim the item is accounted for. Null claims nothing.
    expect(isOpenStatus('Assigned', [])).toBeNull();
    expect(isOpenStatus(null, STATUSES)).toBeNull();
    expect(isOpenStatus('Recycled', STATUSES)).toBeNull();
  });
});
