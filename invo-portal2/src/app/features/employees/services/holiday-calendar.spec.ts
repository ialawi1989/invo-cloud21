import { describe, expect, it } from 'vitest';

import {
  HolidayCalendar,
  duplicateDates,
  holidaysInRange,
  isHoliday,
  isoDate,
} from './holiday-calendar.types';

/**
 * The holiday calendar's pure rules.
 *
 * These are informational only — nothing here feeds a stored leave request's
 * `days`, and the tests say so where it matters. The separation is the reason
 * building the calendar at all is safe: a derived `days` would restate every
 * historical balance the moment a holiday was added.
 */

const CAL: HolidayCalendar = {
  id: 'c1',
  name: 'Bahrain 2026',
  country: 'BH',
  branchIds: ['b1'],
  days: [
    { id: 'd1', date: '2026-12-16', name: 'National Day', recurring: false },
    { id: 'd2', date: '2026-01-01', name: 'New Year', recurring: true },
    { id: 'd3', date: '2026-05-01', name: 'Labour Day', recurring: true },
  ],
};

describe('isHoliday', () => {
  it('finds a date the calendar marks', () => {
    expect(isHoliday(CAL, '2026-05-01')).toBe(true);
  });

  it('does not find one it does not', () => {
    // The inverse. A mutant returning true unconditionally satisfies the test
    // above and turns every working day into a holiday.
    expect(isHoliday(CAL, '2026-05-02')).toBe(false);
  });

  it('treats a missing calendar as no holidays, not as an error', () => {
    // The state on every deployment until the endpoints land.
    expect(isHoliday(null, '2026-05-01')).toBe(false);
  });
});

describe('holidaysInRange', () => {
  it('returns the holidays inside an inclusive range', () => {
    const found = holidaysInRange(CAL, '2026-01-01', '2026-06-30');

    expect(found.map(d => d.date)).toEqual(['2026-01-01', '2026-05-01']);
  });

  it('sorts them by date, whatever order the calendar is in', () => {
    // The range MUST span the out-of-order entry. An earlier version of this
    // case used Jan–Jun, which filtered to two days that were already in order
    // in the source array — so removing the sort changed nothing and the
    // mutant survived. The fixture lists December FIRST; only a range that
    // includes it can tell a sorted result from an unsorted one.
    const found = holidaysInRange(CAL, '2026-01-01', '2026-12-31');

    expect(found.map(d => d.date)).toEqual(['2026-01-01', '2026-05-01', '2026-12-16']);
  });

  it('includes both endpoints', () => {
    // Off-by-one at the boundary is the defect this shape invites, and a
    // half-open range would silently drop a holiday on the last day of leave.
    expect(holidaysInRange(CAL, '2026-05-01', '2026-05-01').map(d => d.date))
      .toEqual(['2026-05-01']);
  });

  it('excludes dates outside it', () => {
    // The inverse of the first case: a mutant returning every day satisfies
    // both of the above and fails here.
    expect(holidaysInRange(CAL, '2026-02-01', '2026-04-30')).toEqual([]);
  });

  it('copes with a reversed range rather than throwing', () => {
    // A user mid-edit types the end date first. That is not an error worth
    // losing the screen over.
    expect(holidaysInRange(CAL, '2026-06-30', '2026-01-01').map(d => d.date))
      .toEqual(['2026-01-01', '2026-05-01']);
  });

  it('returns nothing when there is no calendar', () => {
    expect(holidaysInRange(null, '2026-01-01', '2026-12-31')).toEqual([]);
  });
});

describe('duplicateDates', () => {
  it('names a date entered twice', () => {
    const dupes = duplicateDates([
      { id: '', date: '2026-05-01', name: 'Labour Day', recurring: false },
      { id: '', date: '2026-05-01', name: 'Labour Day (again)', recurring: false },
      { id: '', date: '2026-01-01', name: 'New Year', recurring: false },
    ]);

    expect(dupes).toEqual(['2026-05-01']);
  });

  it('says nothing when every date is distinct', () => {
    // The inverse: a mutant reporting everything as duplicated blocks every
    // save, which is a worse failure than the one it was guarding against.
    expect(duplicateDates(CAL.days)).toEqual([]);
  });

  it('ignores blank dates, which are rows being typed', () => {
    // Two empty rows are not a duplicate — they are someone who clicked Add
    // twice. Reporting them would put an error under a form nobody has
    // finished filling in.
    const dupes = duplicateDates([
      { id: '', date: '', name: '', recurring: false },
      { id: '', date: '', name: '', recurring: false },
    ]);

    expect(dupes).toEqual([]);
  });
});

describe('isoDate', () => {
  it('formats a local calendar day, not a UTC instant', () => {
    // A holiday is a day on a wall calendar. Using toISOString() here would
    // shift the date by one either side of midnight depending on the viewer's
    // timezone, which is how a holiday lands on the wrong day for half a
    // company.
    expect(isoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(isoDate(new Date(2026, 11, 16))).toBe('2026-12-16');
  });

  it('pads single-digit months and days', () => {
    expect(isoDate(new Date(2026, 4, 5))).toBe('2026-05-05');
  });
});
