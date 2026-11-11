import { describe, expect, it } from 'vitest';
import { BoFilter, defaultFilter } from './bo-filter';
import { CarryTarget, carryFilterQuery } from './carry-filter';

const NOW = new Date(2026, 10, 9);
const rangeF = (over: Partial<BoFilter> = {}): BoFilter => ({ ...defaultFilter(false, NOW), ...over });
const asOfF = (over: Partial<BoFilter> = {}): BoFilter => ({ ...defaultFilter(true, NOW), ...over });
const bo = (over: Partial<CarryTarget> = {}): CarryTarget => ({ bo: true, asOf: false, asOfOptional: false, comparison: true, branches: true, ...over });
const generic = (over: Partial<CarryTarget> = {}): CarryTarget => ({ bo: false, asOf: false, asOfOptional: false, comparison: false, branches: true, ...over });

describe('carryFilterQuery → Business Overview report', () => {
  it('keeps range, branches and comparison between two range reports', () => {
    const q = carryFilterQuery(rangeF({ branches: ['a'], compareType: 'period', comparePeriod: 'Month', compareQty: 3 }), bo());
    expect(q).toMatchObject({ from: '2026-11-01', to: '2026-11-30', branches: 'a', cmp: 'period', cmpPeriod: 'Month', cmpQty: '3' });
  });
  it('a range into an as-of-only report becomes its end date; no from is written', () => {
    const q = carryFilterQuery(rangeF(), bo({ asOf: true }));
    expect(q['to']).toBe('2026-11-30');
    expect(q['from']).toBeNull();
    expect(q['range']).toBeNull();
  });
  it('an as-of date into a range-only report becomes the month it falls in', () => {
    const q = carryFilterQuery(asOfF({ to: '2026-11-09' }), bo());
    expect([q['from'], q['to']]).toEqual(['2026-11-01', '2026-11-30']);
  });
  it('an as-of date survives into a range-by-default report that can switch; an as-of-by-default report always opens as of', () => {
    const toGl = carryFilterQuery(asOfF({ to: '2026-11-09' }), bo({ asOf: false, asOfOptional: true }));
    expect(toGl['asof']).toBe('1');
    expect(toGl['to']).toBe('2026-11-09');
    const toBs = carryFilterQuery(rangeF(), bo({ asOf: true, asOfOptional: true }));
    // Balance Sheet / Trial Balance open "as of" by default, even coming from a range
    expect(toBs['range']).toBeNull();
    expect(toBs['from']).toBeNull();
    expect(toBs['to']).toBe('2026-11-30');
  });
  it('drops a comparison the target does not have', () => {
    const q = carryFilterQuery(rangeF({ compareType: 'period' }), bo({ comparison: false }));
    expect(q['cmp']).toBeNull();
  });
});

describe('carryFilterQuery → more filters', () => {
  const full = generic({ comparePeriods: true, openingHour: true, products: true, categories: true, sourceOptions: ['POS', 'Online'], voidTimings: true });
  it('carries opening hours, products, categories, sources, void timings and a period comparison to a report that has them', () => {
    const q = carryFilterQuery(rangeF(), full, {
      applyOpeningHour: true, comparison: { period: 'Month', qty: 3 }, productIds: ['p1', 'p2'], categoryIds: ['c1'],
      sources: ['POS', 'Cloud'], voidTimings: ['sameDay'],
    });
    expect(q).toMatchObject({
      openingHour: '1', cmp: 'Month', cmpQty: '3', products: 'p1,p2', categories: 'c1', sources: 'POS', voidTimings: 'sameDay',
    });
  });
  it('drops each one the target does not offer', () => {
    const q = carryFilterQuery(rangeF(), generic(), {
      applyOpeningHour: true, comparison: { period: 'Year', qty: 2 }, productIds: ['p1'], categoryIds: ['c1'], sources: ['POS'], voidTimings: ['sameDay'],
    });
    expect(q).toMatchObject({ openingHour: null, cmp: null, cmpQty: null, products: null, categories: null, sources: null, voidTimings: null });
  });
  it('a Business Overview period comparison reaches a report with comparison columns', () => {
    const q = carryFilterQuery(rangeF({ compareType: 'period', comparePeriod: 'Month', compareQty: 4 }), full);
    expect(q).toMatchObject({ cmp: 'Month', cmpQty: '4' });
  });
  it('a comparison of a generic report reaches a Business Overview report as a period comparison', () => {
    const q = carryFilterQuery(rangeF(), bo(), { comparison: { period: 'Month', qty: 2 } });
    expect(q).toMatchObject({ cmp: 'period', cmpPeriod: 'Month', cmpQty: '2' });
  });
});

describe('carryFilterQuery → generic report', () => {
  it('range report: preset custom + dates + branches', () => {
    const q = carryFilterQuery(rangeF({ branches: ['a', 'b'] }), generic());
    expect(q).toMatchObject({ preset: 'custom', fromDate: '2026-11-01', toDate: '2026-11-30', branches: 'a,b', compare: null, range: null });
  });
  it('as-of report: both dates are the as-of date', () => {
    const q = carryFilterQuery(rangeF(), generic({ asOf: true }));
    expect([q['fromDate'], q['toDate']]).toEqual(['2026-11-30', '2026-11-30']);
  });
  it('an as-of-by-default report opens as of (the range end) even when the source was a range', () => {
    const q = carryFilterQuery(rangeF(), generic({ asOf: true, asOfOptional: true }));
    expect(q['range']).toBeNull();
    expect([q['fromDate'], q['toDate']]).toEqual(['2026-11-30', '2026-11-30']);
  });
  it('drops branches / comparison the target does not offer; keeps a comparison it does', () => {
    expect(carryFilterQuery(rangeF({ branches: ['a'] }), generic({ branches: false }))['branches']).toBeNull();
    expect(carryFilterQuery(rangeF({ compareType: 'period' }), generic({ comparison: true }))['compare']).toBe('true');
    expect(carryFilterQuery(rangeF({ compareType: 'period' }), generic())['compare']).toBeNull();
  });
});
