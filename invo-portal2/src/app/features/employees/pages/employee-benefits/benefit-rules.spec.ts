import { describe, expect, it } from 'vitest';

import {
  hasHousingAllowance,
  housingBlockedBy,
  housingConflict,
  isActiveWindow,
  ratePercent,
} from './benefit-rules';

describe('hasHousingAllowance', () => {
  it('finds the Housing component regardless of case', () => {
    expect(hasHousingAllowance([{ type: 'Housing' }])).toBe(true);
    expect(hasHousingAllowance([{ type: 'housing' }])).toBe(true);
    expect(hasHousingAllowance([{ type: '  HOUSING  ' }])).toBe(true);
  });

  it('does not confuse Housing with another component', () => {
    expect(hasHousingAllowance([{ type: 'Transport' }, { type: 'Bonus' }])).toBe(false);
  });

  it('treats a zero or absent amount as still an allowance', () => {
    // Deliberate: the rule asks whether the component EXISTS, not what it is
    // worth. A zero housing allowance is still a housing allowance, and reading
    // it as absent would let both sides be set.
    expect(hasHousingAllowance([{ type: 'Housing', direction: 'earning' }])).toBe(true);
  });

  it('survives a junk payload', () => {
    expect(hasHousingAllowance(null)).toBe(false);
    expect(hasHousingAllowance([])).toBe(false);
    expect(hasHousingAllowance([{ type: null }])).toBe(false);
  });
});

describe('housingBlockedBy', () => {
  it('names the reason rather than returning a bare false', () => {
    expect(housingBlockedBy([{ type: 'Housing' }])).toBe('payrollHousingComponent');
  });

  it('allows company housing when no allowance exists', () => {
    expect(housingBlockedBy([{ type: 'Transport' }])).toBeNull();
    expect(housingBlockedBy(null)).toBeNull();
  });
});

describe('housingConflict', () => {
  it('reports an EXISTING contradiction rather than blocking it', () => {
    // The asymmetry that matters: a record which already has both is surfaced,
    // not silently corrected. Clearing either side would destroy a value the
    // user never asked to lose.
    expect(housingConflict(true, [{ type: 'Housing' }])).toBe(true);
  });

  it('is not a conflict when housing is not provided', () => {
    expect(housingConflict(false, [{ type: 'Housing' }])).toBe(false);
  });

  it('is not a conflict without a housing component', () => {
    expect(housingConflict(true, [{ type: 'Food' }])).toBe(false);
  });
});

describe('ratePercent', () => {
  it('parses a numeric arriving as a string', () => {
    expect(ratePercent('7.5')).toBe(7.5);
    expect(ratePercent('0')).toBe(0);
  });

  it('returns null for absent or unparseable values, NEVER 0', () => {
    // The bug this prevents: Number('') === 0, so an empty rate would render as
    // a 0% contribution — a claim the server never made.
    expect(ratePercent('')).toBeNull();
    expect(ratePercent('   ')).toBeNull();
    expect(ratePercent(null)).toBeNull();
    expect(ratePercent(undefined)).toBeNull();
    expect(ratePercent('n/a')).toBeNull();
  });
});

describe('isActiveWindow', () => {
  const today = '2026-08-13';

  it('is open when the start has passed and there is no end', () => {
    expect(isActiveWindow('2026-01-01', null, today)).toBe(true);
  });

  it('is not yet open before the start date', () => {
    expect(isActiveWindow('2026-12-01', null, today)).toBe(false);
  });

  it('is closed after the end date', () => {
    expect(isActiveWindow('2026-01-01', '2026-08-12', today)).toBe(false);
  });

  it('is open ON the boundary days, both ends', () => {
    expect(isActiveWindow(today, null, today)).toBe(true);
    expect(isActiveWindow('2026-01-01', today, today)).toBe(true);
  });

  it('treats a window with no dates at all as open', () => {
    expect(isActiveWindow(null, null, today)).toBe(true);
  });
});
