import { describe, expect, it } from 'vitest';

import {
  ClearanceRow,
  EosRecord,
  SettlementLine,
  clearanceBlockers,
  clearanceComplete,
  completionBlockers,
  noticeServedDays,
  parseDayUtc,
  seedClearance,
  settlementTotal,
} from './employee-eos.types';

/**
 * End of Service rules.
 *
 * The module computes almost nothing on purpose — no gratuity, no proration,
 * no encashment. What IS here is arithmetic on two dates and a set of gates,
 * and those gates decide whether someone's system access is revoked and their
 * termination date set, so they are worth pinning hard.
 */

const row = (over: Partial<ClearanceRow> = {}): ClearanceRow => ({
  id: '', department: 'IT', owner: null, status: 'Cleared',
  blockingReason: null, clearedAt: null, ...over,
});

const line = (over: Partial<SettlementLine> = {}): SettlementLine => ({
  id: '', lineKey: 'UNPAID_SALARY', amount: 100, calculationNote: null,
  isOverridden: false, overrideReason: null, ...over,
});

const record = (over: Partial<EosRecord> = {}): EosRecord => ({
  id: null, type: 'Resignation', noticeGivenDate: '2026-08-01',
  lastWorkingDay: '2026-08-31', reason: 'Personal', rehireEligible: true,
  rehireReason: null,
  exitInterview: { conductedBy: null, date: null, summary: null },
  clearance: [row(), row({ department: 'HR' })],
  settlement: [line()],
  visaCancellationDate: null, accessRevokedAt: null, completedAt: null,
  ...over,
});

describe('noticeServedDays', () => {
  it('counts the days between notice and the last working day', () => {
    expect(noticeServedDays('2026-08-01', '2026-08-31')).toBe(30);
  });

  it('is null when either date is missing, not zero', () => {
    // 0 is a real answer — notice given on the last day. Conflating it with
    // "not entered" would show a shortfall against a contractual period for a
    // record nobody has filled in yet, and a shortfall is what creates a
    // payment-in-lieu line.
    expect(noticeServedDays(null, '2026-08-31')).toBeNull();
    expect(noticeServedDays('2026-08-01', null)).toBeNull();
  });

  it('reports 0, not a negative, when the dates are the wrong way round', () => {
    // A negative would flow into a shortfall calculation and read as an
    // entitlement — the wrong direction for a data-entry error.
    expect(noticeServedDays('2026-08-31', '2026-08-01')).toBe(0);
  });

  it('is 0 when notice was given on the last working day', () => {
    // The inverse of the null case: this genuinely is zero.
    expect(noticeServedDays('2026-08-31', '2026-08-31')).toBe(0);
  });

  it('spans month boundaries correctly', () => {
    expect(noticeServedDays('2026-03-01', '2026-04-01')).toBe(31);
    expect(noticeServedDays('2026-10-01', '2026-11-01')).toBe(31);
  });

  it('parses a day as UTC midnight, not local midnight', () => {
    // ── WHY THIS ASSERTS THE PARSE AND NOT THE DAY COUNT ────────────────────
    // The obvious test — "the count is the same in any timezone" — CANNOT
    // FAIL. Local parsing shifts both endpoints by the same offset, so the
    // difference is identical; it diverges only across a DST boundary, which a
    // machine in a zone without DST never produces. A mutant dropping the `Z`
    // survived every assertion made through noticeServedDays().
    //
    // The absolute epoch is observable from anywhere, so that is what is
    // asserted. This is the assertion that actually differs.
    expect(parseDayUtc('2026-03-01')).toBe(Date.UTC(2026, 2, 1));
    expect(parseDayUtc('2026-12-16')).toBe(Date.UTC(2026, 11, 16));
  });
});

describe('clearance — an unreturned asset blocks', () => {
  it('blocks while the employee still holds company property', () => {
    // Spec §4.11 makes this the clearance gate. The count comes from the
    // server's getOpenAssets — this function is given a NUMBER precisely so it
    // cannot invent a second definition of "still assigned".
    const blockers = clearanceBlockers([row(), row({ department: 'HR' })], 2);

    expect(blockers.map(b => b.key)).toContain('EMPLOYEES.EOS.BLOCKED_OPEN_ASSETS');
    expect(clearanceComplete([row(), row({ department: 'HR' })], 2)).toBe(false);
  });

  it('does not block when nothing is held and every row is cleared', () => {
    // The inverse. A mutant that always blocks satisfies the test above and
    // makes clearance impossible to finish for anyone.
    expect(clearanceBlockers([row(), row({ department: 'HR' })], 0)).toEqual([]);
    expect(clearanceComplete([row(), row({ department: 'HR' })], 0)).toBe(true);
  });

  it('names every outstanding department, not just the first', () => {
    // Someone chasing a clearance needs the whole list. Returning only the
    // first means the same discovery five times.
    const blockers = clearanceBlockers([
      row({ department: 'IT', status: 'Pending' }),
      row({ department: 'Finance', status: 'Blocked', blockingReason: 'laptop' }),
      row({ department: 'HR' }),
    ], 0);

    expect(blockers).toHaveLength(2);
    expect(blockers.map(b => b.detail)).toEqual(['IT', 'Finance']);
  });

  it('distinguishes Pending from Blocked', () => {
    // They mean different things to whoever is chasing: one is waiting, the
    // other is refused and has a reason.
    expect(clearanceBlockers([row({ status: 'Pending' })], 0)[0].key)
      .toBe('EMPLOYEES.EOS.PENDING_DEPARTMENT');
    expect(clearanceBlockers([row({ status: 'Blocked' })], 0)[0].key)
      .toBe('EMPLOYEES.EOS.BLOCKED_DEPARTMENT');
  });

  it('seeds the five departments the spec names', () => {
    expect(seedClearance().map(r => r.department))
      .toEqual(['IT', 'Finance', 'HR', 'Admin', 'LineManager']);
    // Seeded rows start Pending — a seeded row that started Cleared would mean
    // a clearance nobody performed.
    expect(seedClearance().every(r => r.status === 'Pending')).toBe(true);
  });
});

describe('completionBlockers — the irreversible step', () => {
  it('allows completion when everything is in order', () => {
    // The control. If this were never empty, every assertion below would pass
    // for the wrong reason.
    expect(completionBlockers(record(), 0, false)).toEqual([]);
  });

  it('requires a reason when someone is marked not eligible for rehire', () => {
    // It follows a person for years. It does not get to be an unexplained
    // checkbox.
    const blockers = completionBlockers(
      record({ rehireEligible: false, rehireReason: null }), 0, false,
    );

    expect(blockers.map(b => b.key)).toContain('EMPLOYEES.EOS.NEEDS_REHIRE_REASON');
  });

  it('accepts a not-eligible mark that carries a reason', () => {
    expect(completionBlockers(
      record({ rehireEligible: false, rehireReason: 'Gross misconduct' }), 0, false,
    )).toEqual([]);
  });

  it('requires a visa cancellation date only when the caller says so', () => {
    // The nationality rule lives with the CALLER, which has the profile. This
    // function is never given a nationality, so it cannot encode a country
    // rule by accident — 'BH' does not appear in this module.
    expect(completionBlockers(record(), 0, true).map(b => b.key))
      .toContain('EMPLOYEES.EOS.NEEDS_VISA_CANCELLATION');
    expect(completionBlockers(record(), 0, false).map(b => b.key))
      .not.toContain('EMPLOYEES.EOS.NEEDS_VISA_CANCELLATION');
  });

  it('requires a reason for every overridden settlement line', () => {
    const blockers = completionBlockers(
      record({ settlement: [line({ isOverridden: true, overrideReason: null })] }), 0, false,
    );

    expect(blockers.map(b => b.key)).toContain('EMPLOYEES.EOS.NEEDS_OVERRIDE_REASON');
  });

  it('accepts an override that explains itself', () => {
    expect(completionBlockers(
      record({ settlement: [line({ isOverridden: true, overrideReason: 'Agreed with HR' })] }),
      0, false,
    )).toEqual([]);
  });

  it('still refuses while an asset is outstanding', () => {
    // Completion sets the top-level terminationDate and revokes access, so the
    // asset gate applies here too and not only to clearance.
    expect(completionBlockers(record(), 1, false).map(b => b.key))
      .toContain('EMPLOYEES.EOS.BLOCKED_OPEN_ASSETS');
  });

  it('lists the missing required fields', () => {
    const blockers = completionBlockers(
      record({ type: null, lastWorkingDay: null, reason: null }), 0, false,
    );

    expect(blockers.map(b => b.key)).toEqual(expect.arrayContaining([
      'EMPLOYEES.EOS.NEEDS_TYPE',
      'EMPLOYEES.EOS.NEEDS_LAST_DAY',
      'EMPLOYEES.EOS.NEEDS_REASON',
    ]));
  });
});

describe('settlementTotal — a sum of what was typed in', () => {
  it('adds the entered amounts', () => {
    expect(settlementTotal([line({ amount: 100 }), line({ amount: 250.5 })])).toBe(350.5);
  });

  it('is null while any line is undecided', () => {
    // An undecided line is not a zero line. Showing a total over a partial
    // settlement presents an incomplete figure as final, which is the exact
    // failure the whole no-calculation decision exists to avoid.
    expect(settlementTotal([line({ amount: 100 }), line({ amount: null })])).toBeNull();
  });

  it('is null when there are no lines at all', () => {
    expect(settlementTotal([])).toBeNull();
  });

  it('counts a genuine zero', () => {
    // The inverse of the null case: 0 entered deliberately is a real amount and
    // must not be treated as missing.
    expect(settlementTotal([line({ amount: 0 }), line({ amount: 50 })])).toBe(50);
  });
});
