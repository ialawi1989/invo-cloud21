import { describe, expect, it } from 'vitest';
import { DATE_PRESETS, resolvePreset } from './report-period.util';

describe('resolvePreset — the legacy date picker presets', () => {
  // Wednesday 11 Nov 2026
  const WED = new Date(2026, 10, 11, 10, 0, 0);
  const r = (k: Parameters<typeof resolvePreset>[0], now = WED) => resolvePreset(k, undefined, now);

  it('weeks run Sunday to Saturday', () => {
    expect(r('thisWeek')).toEqual({ from: '2026-11-08', to: '2026-11-14' });
    expect(r('previousWeek')).toEqual({ from: '2026-11-01', to: '2026-11-07' });
  });
  it('quarters: this one covers all of Oct–Dec, the previous one Jul–Sep', () => {
    expect(r('thisQuarter')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(r('previousQuarter')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
  });
  it('the previous quarter of Q1 is Q4 of last year', () => {
    expect(r('previousQuarter', new Date(2026, 1, 10))).toEqual({ from: '2025-10-01', to: '2025-12-31' });
  });
  it('years: this year whole, year to date stops today, previous year whole', () => {
    expect(r('thisYear')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(r('yearToDate')).toEqual({ from: '2026-01-01', to: '2026-11-11' });
    expect(r('previousYear')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
  it('previous month and the older presets still resolve', () => {
    expect(r('lastMonth')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(r('last7')).toEqual({ from: '2026-11-05', to: '2026-11-11' });
  });
  it('lists the presets in the legacy order, Custom last', () => {
    expect(DATE_PRESETS.map(p => p.key)).toEqual([
      'today', 'thisWeek', 'thisMonth', 'thisQuarter', 'thisYear', 'yearToDate',
      'yesterday', 'previousWeek', 'lastMonth', 'previousQuarter', 'previousYear', 'custom',
    ]);
  });
});
