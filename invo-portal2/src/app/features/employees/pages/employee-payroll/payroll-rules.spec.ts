import { describe, expect, it } from 'vitest';

import { num } from '../../services/employee-payroll.service';
import {
  PayrollActor,
  isValidIban,
  maskIban,
  mayEditBank,
  mayEditLoans,
  mayEditPay,
  mayViewBank,
  mayViewPay,
  splitTotal,
  splitsAreValid,
} from './payroll-rules';

/**
 * Payroll's four grants, the IBAN checksum, and the numeric coercion.
 *
 * ── FIXTURES THAT CAN DISTINGUISH THE IMPLEMENTATIONS ────────────────────────
 * Each actor holds ONE grant. An actor holding viewPay+viewBank would pass
 * against a rule that checked either one, so the whole point of the split would
 * go untested. The subject is a fourth, separate id.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const base: PayrollActor = {
  actorEmployeeId: 'emp-hr',
  subjectEmployeeId: 'emp-subject',
  canViewPay: false, canEditPay: false, canViewBank: false, canEditBank: false,
};

const PAY_VIEWER = { ...base, canViewPay: true };
const PAY_EDITOR = { ...base, canViewPay: true, canEditPay: true };
const BANK_VIEWER = { ...base, canViewBank: true };
const BANK_EDITOR = { ...base, canViewBank: true, canEditBank: true };
/** The employee, holding nothing. */
const SUBJECT = { ...base, actorEmployeeId: 'emp-subject' };

describe('the pay/bank split', () => {
  /**
   * THE ONE THAT MATTERS.
   *
   * Someone approving a rise has no business seeing the IBAN. PAY_EDITOR holds
   * both pay grants and neither bank grant, so a rule that fell back to viewPay
   * fails here.
   */
  it('does not let a pay grant open the bank panel', () => {
    expect(mayViewPay(PAY_EDITOR)).toBe(true);
    expect(mayViewBank(PAY_EDITOR)).toBe(false);
    expect(mayEditBank(PAY_EDITOR)).toBe(false);
  });

  /** And the reverse: reconciling a transfer is no reason to see the salary. */
  it('does not let a bank grant open the pay panel', () => {
    expect(mayViewBank(BANK_EDITOR)).toBe(true);
    expect(mayViewPay(BANK_EDITOR)).toBe(false);
    expect(mayEditPay(BANK_EDITOR)).toBe(false);
  });

  it('keeps editBank separate from viewBank', () => {
    // The fraud is changing an account number, not reading one.
    expect(mayViewBank(BANK_VIEWER)).toBe(true);
    expect(mayEditBank(BANK_VIEWER)).toBe(false);
    expect(mayEditBank(BANK_EDITOR)).toBe(true);
  });

  it('keeps editPay separate from viewPay', () => {
    expect(mayViewPay(PAY_VIEWER)).toBe(true);
    expect(mayEditPay(PAY_VIEWER)).toBe(false);
    expect(mayEditPay(PAY_EDITOR)).toBe(true);
  });
});

describe('the subject', () => {
  it('reads their own pay and their own bank details', () => {
    expect(mayViewPay(SUBJECT)).toBe(true);
    expect(mayViewBank(SUBJECT)).toBe(true);
  });

  it('writes neither, whatever they hold', () => {
    // Nobody sets their own salary, and nobody redirects their own transfer —
    // the server refuses isSelf on both write paths.
    const subjectWithEverything: PayrollActor = {
      ...SUBJECT,
      canViewPay: true, canEditPay: true, canViewBank: true, canEditBank: true,
    };
    expect(mayEditPay(subjectWithEverything)).toBe(false);
    expect(mayEditBank(subjectWithEverything)).toBe(false);
    expect(mayEditLoans(subjectWithEverything)).toBe(false);
  });
});

describe('isValidIban', () => {
  /**
   * Real, published check-digit-valid IBANs from the ISO 13616 examples.
   * A fixture that merely "looks like" an IBAN would pass a stub that only
   * checked the shape, which is the implementation this is guarding against.
   */
  it('accepts valid IBANs', () => {
    expect(isValidIban('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('BH67BMAG00001299123456')).toBe(true);
    expect(isValidIban('SA0380000000608010167519')).toBe(true);
  });

  it('rejects a transposition that leaves the length intact', () => {
    // The failure the checksum exists for: right shape, right length, wrong
    // account. A format-only check passes this.
    expect(isValidIban('GB82WEST12345698765423')).toBe(false);
    expect(isValidIban('DE89370400440532013001')).toBe(false);
  });

  it('rejects a wrong length for a country it knows', () => {
    expect(isValidIban('BH67BMAG0000129912345')).toBe(false);
  });

  it('accepts an unknown country on the checksum alone', () => {
    // The registry changes; a stale table must not block a real account. This
    // is check-digit valid with a country prefix not in the length table.
    expect(isValidIban('MT84MALT011000012345MTLCAST001S')).toBe(true);
  });

  it('rejects rubbish and blanks', () => {
    expect(isValidIban('')).toBe(false);
    expect(isValidIban(null)).toBe(false);
    expect(isValidIban('not an iban')).toBe(false);
    expect(isValidIban('GB82')).toBe(false);
  });

  it('ignores the spaces people actually type', () => {
    expect(isValidIban('gb82 west 1234 5698 7654 32')).toBe(true);
    expect(isValidIban('GB82-WEST-1234-5698-7654-32')).toBe(true);
  });
});

describe('maskIban', () => {
  it('shows no more than the audit kept', () => {
    // The audit stores the last four characters and nothing else, so nothing
    // describing a change may show more.
    expect(maskIban('GB82WEST12345698765432')).toBe('••••5432');
  });

  it('masks a short or absent value entirely rather than partially', () => {
    expect(maskIban('12')).toBe('••••');
    expect(maskIban('')).toBe('');
    expect(maskIban(null)).toBe('');
  });
});

describe('split payments', () => {
  it('accepts an empty list — no split', () => {
    expect(splitsAreValid([])).toBe(true);
    expect(splitsAreValid(null)).toBe(true);
  });

  it('accepts a list totalling 100', () => {
    expect(splitsAreValid([{ percentage: 60 }, { percentage: 40 }])).toBe(true);
  });

  /**
   * The tolerance, with a fixture that needs it.
   *
   * 33.33 + 33.33 + 33.34 is exactly 100 in IEEE 754 and would pass an exact
   * comparison, so it tests nothing. These do not: ten at 10.1/9.1 comes to
   * 99.99999999999999.
   */
  it('absorbs floating-point residue', () => {
    const ten = [10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 9.1]
      .map(percentage => ({ percentage }));
    expect(splitTotal(ten)).not.toBe(100);
    expect(splitsAreValid(ten)).toBe(true);
  });

  it('does not let the tolerance swallow a real shortfall', () => {
    // 99.99 is off by exactly 0.01, which the server's `< 0.01` refuses too.
    // Paying out 99.99% of a salary is not a rounding decision to make quietly.
    expect(splitsAreValid([{ percentage: 33.33 }, { percentage: 33.33 }, { percentage: 33.33 }]))
      .toBe(false);
    expect(splitsAreValid([{ percentage: 60 }, { percentage: 30 }])).toBe(false);
    expect(splitsAreValid([{ percentage: 60 }, { percentage: 50 }])).toBe(false);
  });

  it('counts a missing percentage as zero rather than skipping it', () => {
    // Skipping would make a half-filled form look valid while the save failed.
    expect(splitTotal([{ percentage: 100 }, { percentage: null }])).toBe(100);
    expect(splitsAreValid([{ percentage: 100 }, { percentage: null }])).toBe(true);
    expect(splitsAreValid([{ percentage: 60 }, { percentage: null }])).toBe(false);
  });
});

/**
 * The numeric coercion.
 *
 * Every money field on this screen is a Postgres `numeric`, which
 * node-postgres returns as a STRING. Getting this wrong renders every salary as
 * unknown — and because the unknown state is deliberate elsewhere in the
 * feature, it looks like the server sent nothing rather than like a bug.
 */
describe('num', () => {
  it('accepts the strings Postgres actually sends', () => {
    expect(num('1250.000')).toBe(1250);
    expect(num('0.500')).toBe(0.5);
    expect(num('12500')).toBe(12500);
  });

  it('keeps zero, which is a real figure', () => {
    // A zero deduction is not a missing deduction.
    expect(num('0')).toBe(0);
    expect(num('0.000')).toBe(0);
    expect(num(0)).toBe(0);
  });

  it('leaves absent values null', () => {
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('')).toBeNull();
    expect(num('   ')).toBeNull();
  });

  it('does not turn nonsense into a number', () => {
    expect(num('abc')).toBeNull();
    expect(num(NaN)).toBeNull();
    expect(num(Infinity)).toBeNull();
    expect(num({})).toBeNull();
  });
});
