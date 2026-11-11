import { describe, expect, it } from 'vitest';
import {
  BoFilter, defaultFilter, filterFromQuery, filterToQuery, normalizeFilter, profitLossQueryFor, sortFromQuery,
  toApiFilter,
} from './bo-filter';

const NOW = new Date(2026, 10, 9); // 9 Nov 2026
const base = (over: Partial<BoFilter> = {}): BoFilter => ({ ...defaultFilter(false, NOW), ...over });

describe('defaultFilter', () => {
  it('range = this month; as-of = today', () => {
    const r = defaultFilter(false, NOW);
    expect([r.from, r.to]).toEqual(['2026-11-01', '2026-11-30']);
    const a = defaultFilter(true, NOW);
    expect(a.to).toBe('2026-11-09');
  });
});

describe('toApiFilter', () => {
  it('range: fromDate/toDate, no comparison', () => {
    expect(toApiFilter(base(), false)).toEqual({
      page: 1, fromDate: '2026-11-01', toDate: '2026-11-30', allowComparison: false, periodQty: 1,
    });
  });
  it('as-of: date + toDate + allowAsOf, no fromDate', () => {
    const o = toApiFilter(base({ to: '2026-11-09', asOf: true }), true);
    expect(o).toMatchObject({ date: '2026-11-09', toDate: '2026-11-09', allowAsOf: true });
    expect(o['fromDate']).toBeUndefined();
  });
  it('as-of + period comparison sends NO fromDate — the backend anchors it from the period', () => {
    const o = toApiFilter(base({ asOf: true, to: '2026-11-10', compareType: 'period', comparePeriod: 'Month', compareQty: 9 }), true);
    expect(o).toMatchObject({ date: '2026-11-10', toDate: '2026-11-10', allowAsOf: true, period: 'Month', periodQty: 9 });
    expect(o['fromDate']).toBeUndefined();
  });
  it('period comparison sends Period + period/compareWith + qty', () => {
    const o = toApiFilter(base({ compareType: 'period', comparePeriod: 'Month', compareQty: 3 }), false);
    expect(o).toMatchObject({
      allowComparison: true, compareType: 'Period', period: 'Month', compareWith: 'Month', periodQty: 3,
    });
  });
  it('branch comparison needs 2+ branches, otherwise degrades to none', () => {
    const one = toApiFilter(base({ compareType: 'branch', branches: ['a'] }), false);
    expect(one['allowComparison']).toBe(false);
    const two = toApiFilter(base({ compareType: 'branch', branches: ['a', 'b'] }), false);
    expect(two).toMatchObject({ allowComparison: true, compareType: 'Branch', branches: ['a', 'b'], periodQty: 1 });
    expect(two['period']).toBeUndefined();
  });
  it('omits branches when none selected', () => {
    expect(toApiFilter(base(), false)['branches']).toBeUndefined();
  });
});

describe('normalizeFilter', () => {
  it('clamps qty to 1..10 and handles junk', () => {
    expect(normalizeFilter(base({ compareQty: 99 })).compareQty).toBe(10);
    expect(normalizeFilter(base({ compareQty: 0 })).compareQty).toBe(1);
    expect(normalizeFilter(base({ compareQty: NaN })).compareQty).toBe(1);
  });
});

describe('profitLossQueryFor', () => {
  it('is year-to-date up to the sheet date, carrying branches only', () => {
    const f = base({ to: '2026-06-30', branches: ['a', 'b'], compareType: 'period' });
    expect(profitLossQueryFor(f)).toEqual({ from: '2026-01-01', to: '2026-06-30', branches: 'a,b' });
    expect(profitLossQueryFor(base({ to: '2025-03-01' }))).toEqual({ from: '2025-01-01', to: '2025-03-01' });
  });
});

describe('URL codec', () => {
  it('round-trips a full filter', () => {
    const f = base({ branches: ['a', 'b'], compareType: 'period', comparePeriod: 'Month', compareQty: 4 });
    const q = filterToQuery(f, false) as Record<string, any>;
    expect(filterFromQuery(q, false, NOW)).toEqual(f);
  });
  it('as-of does not write `from`', () => {
    expect(filterToQuery(defaultFilter(true, NOW), true)['from']).toBeNull();
  });
  it('an as-of report switched to a range writes range=1 + from, and reads it back', () => {
    const f = { ...defaultFilter(false, NOW), asOf: false };
    const q = filterToQuery(f, true) as Record<string, any>;
    expect(q['range']).toBe('1');
    expect(q['from']).toBe('2026-11-01');
    const back = filterFromQuery(q, true, NOW, true);
    expect(back.asOf).toBe(false);
    expect([back.from, back.to]).toEqual(['2026-11-01', '2026-11-30']);
  });
  it('a range report switched to as-of writes asof=1 (no from) and reads it back', () => {
    const f = { ...defaultFilter(true, NOW), asOf: true };
    const q = filterToQuery(f, false) as Record<string, any>;
    expect(q['asof']).toBe('1');
    expect(q['range']).toBeNull();
    expect(q['from']).toBeNull();
    expect(filterFromQuery(q, false, NOW, true).asOf).toBe(true);
  });
  it('asof=1 is ignored when the report cannot switch, and a range default never writes it', () => {
    expect(filterFromQuery({ asof: '1' }, false, NOW, false).asOf).toBe(false);
    expect(filterToQuery(base(), false)['asof']).toBeNull();
  });
  it('range=1 is ignored when the report cannot switch', () => {
    expect(filterFromQuery({ range: '1' }, true, NOW, false).asOf).toBe(true);
  });
  it('a range report never writes range', () => {
    expect(filterToQuery(base(), false)['range']).toBeNull();
  });
  it('a switched report sends a plain range payload (allowAsOf false / absent)', () => {
    const o = toApiFilter({ ...base(), asOf: false }, true);
    expect(o).toMatchObject({ fromDate: '2026-11-01', toDate: '2026-11-30' });
    expect(o['allowAsOf']).toBeUndefined();
  });
  it('ignores malformed values and falls back to defaults', () => {
    const f = filterFromQuery({ from: 'nope', to: '2026-13', cmp: 'weird', cmpQty: 'x' }, false, NOW);
    expect(f).toEqual(defaultFilter(false, NOW));
  });
  it('sort: needs both a column and a valid direction', () => {
    expect(sortFromQuery({ sortBy: 'x', sortDirection: 'desc' })).toEqual({ sortValue: 'x', sortDirection: 'desc' });
    expect(sortFromQuery({ sortBy: 'x', sortDirection: 'sideways' })).toBeNull();
    expect(sortFromQuery({})).toBeNull();
  });
});
