import { MathUtils } from '@core/math/math-helpers';

// ═══ Company settings: commission + tips ═══════════════════════════════

export type CommissionEligibilityType = 'immediate' | 'days_after_sale' | 'after_return_period';
export type CommissionPaymentCycle = 'weekly' | 'biweekly' | 'monthly' | 'manual';

/**
 * `Company.employeeCommissionOptions`: when commission on a paid invoice is earned, and the payout cycle that
 * decides which items a new payout pre-selects. `null` on the company means it was never configured.
 */
export class EmployeeCommissionOptions {
  /** Commission is opt-in: off until the company switches it on. */
  enabled = false;
  eligibilityType: CommissionEligibilityType | null = null;
  /** Only for `days_after_sale`: a whole number of at least 1. */
  eligibilityDays: number | null = null;
  paymentCycle: CommissionPaymentCycle = 'monthly';
  /** `YYYY-MM-DD`; only for weekly and biweekly cycles. */
  paymentCycleStartDate: string | null = null;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }

  /** What the server applies when nothing was saved: after the return period if the company has one, otherwise immediately. */
  static effectiveDefault(returnPeriodDays: number | null | undefined): EmployeeCommissionOptions {
    const options = new EmployeeCommissionOptions();
    options.eligibilityType = (returnPeriodDays ?? 0) > 0 ? 'after_return_period' : 'immediate';
    return options;
  }

  get needsDays(): boolean { return this.eligibilityType === 'days_after_sale'; }
  get needsStartDate(): boolean { return this.paymentCycle === 'weekly' || this.paymentCycle === 'biweekly'; }

  /** The first problem as a translation key, or null. Mirrors the server's checks. */
  validate(returnPeriodDays: number | null | undefined): string | null {
    if (!this.eligibilityType) return 'COMMISSION_SETTINGS.ERRORS.ELIGIBILITY_REQUIRED';
    if (this.needsDays && !(Number.isInteger(this.eligibilityDays) && (this.eligibilityDays as number) >= 1)) {
      return 'COMMISSION_SETTINGS.ERRORS.DAYS_INVALID';
    }
    if (this.eligibilityType === 'after_return_period' && !((returnPeriodDays ?? 0) > 0)) {
      return 'COMMISSION_SETTINGS.ERRORS.NO_RETURN_PERIOD';
    }
    if (this.needsStartDate && !this.paymentCycleStartDate) return 'COMMISSION_SETTINGS.ERRORS.START_DATE_REQUIRED';
    return null;
  }

  /** Every field, with the ones that don't apply cleared. The server resets any field left out, so a save always sends the whole object. */
  toPayload(): EmployeeCommissionOptions {
    const payload = new EmployeeCommissionOptions();
    payload.enabled = !!this.enabled;
    payload.eligibilityType = this.eligibilityType;
    payload.eligibilityDays = this.needsDays ? this.eligibilityDays : null;
    payload.paymentCycle = this.paymentCycle;
    payload.paymentCycleStartDate = this.needsStartDate ? this.paymentCycleStartDate : null;
    return payload;
  }
}

/** `Company.employeeTipOptions`: how tips are treated on the company. `null` on the company means every default. */
export class EmployeeTipOptions {
  /** Tips are opt-in: off until the company switches them on. */
  enabled = false;
  /** Take the card fee off a tip paid by card, before it reaches the employee. Off by default: unlawful in some countries. */
  deductCardFeeFromTips = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) (this as any)[key] = json[key];
    }
  }

  /** The server accepts booleans only ("Invalid tip card-fee setting"), so the values are coerced. */
  toPayload(): EmployeeTipOptions {
    const payload = new EmployeeTipOptions();
    payload.enabled = !!this.enabled;
    payload.deductCardFeeFromTips = !!this.deductCardFeeFromTips;
    return payload;
  }
}

// ═══ Payouts ═══════════════════════════════════════════════════════════

export type PayableSource = 'commission' | 'tip';

/** One row of `accounts/getEmployeePayables/:employeeId`. */
export interface PayableRecord {
  source: PayableSource;
  /** EmployeeCommissions.id or EmployeeTips.id; sent back as the line's `sourceId`. */
  id: string;
  status: string;
  /** Tips only: `direct` or `share`. */
  kind?: string;
  employeeId?: string;
  branchId?: string;
  invoiceNumber?: string | null;
  date?: string | null;
  description?: string | null;
  /** Negative for Overpaid rows: an offset that reduces the payout. */
  outstandingAmount: number;
  lastEarnedDate?: string | null;
  /** Earned on or before the end of the last completed payment cycle. */
  preselected: boolean;
}

/** A line of a saved payout, from `accounts/getEmployeePayout/:payoutId`. */
export interface SavedPayoutLine {
  source: PayableSource;
  sourceId: string;
  amount: number;
  invoiceNumber?: string | null;
  date?: string | null;
  description?: string | null;
}

export interface PayoutLinePayload { source: PayableSource; sourceId: string; amount: number }

export interface EmployeePayoutPayload {
  /** Omit to create; set to replace every line of an existing payout. */
  id?: string;
  employeeId: string;
  branchId: string;
  paymentDate: string;
  /** The server pays from this method's account for the payout's branch. */
  paymentMethodId: string;
  reference: string | null;
  notes: string | null;
  lines: PayoutLinePayload[];
}

/** A payable row on the payout form: ticked or not, and how much of it to pay. */
export class PayoutLine {
  selected: boolean;
  amount: number | null;

  constructor(public record: PayableRecord, selected = record.preselected, amount: number | null = record.outstandingAmount) {
    this.selected = selected;
    this.amount = amount;
  }

  get isOffset(): boolean { return this.record.outstandingAmount < 0; }

  /** The problem with a ticked line's amount as a translation key, or null. Mirrors the server's bounds. */
  get amountError(): string | null {
    if (!this.selected) return null;
    if (this.amount === null || this.amount === undefined || (this.amount as any) === '' || !Number.isFinite(Number(this.amount))) {
      return 'EMPLOYEE_PAYOUT.ERRORS.AMOUNT_NOT_NUMBER';
    }
    const amount = Number(this.amount);
    const outstanding = this.record.outstandingAmount;
    if (outstanding < 0) return amount < 0 && amount >= outstanding ? null : 'EMPLOYEE_PAYOUT.ERRORS.OFFSET_RANGE';
    return amount > 0 && amount <= outstanding ? null : 'EMPLOYEE_PAYOUT.ERRORS.AMOUNT_RANGE';
  }
}

/**
 * Lines for the payout form. For a new payout, rows the server pre-selected are ticked with their full outstanding
 * balance. When editing, the server counts this payout's own lines back as outstanding, so each line is added back
 * onto its row (or rebuilds the row when the payout paid it in full), ticked with the amount it paid. Other rows
 * stay unticked so opening an edit doesn't change the payout.
 */
export function buildPayoutLines(records: PayableRecord[], existing?: SavedPayoutLine[]): PayoutLine[] {
  if (!existing) return records.map(record => new PayoutLine(record));

  const key = (source: string, id: string) => `${source}:${id}`;
  const existingByKey = new Map(existing.map(line => [key(line.source, line.sourceId), line]));

  const lines = records.map(record => {
    const paid = existingByKey.get(key(record.source, record.id));
    if (!paid) return new PayoutLine(record, false);
    existingByKey.delete(key(record.source, record.id));
    const restored = { ...record, outstandingAmount: MathUtils.add(record.outstandingAmount, paid.amount) };
    return new PayoutLine(restored, true, paid.amount);
  });

  existingByKey.forEach(paid => {
    const rebuilt: PayableRecord = {
      source: paid.source, id: paid.sourceId, status: '',
      invoiceNumber: paid.invoiceNumber ?? null, date: paid.date ?? null, description: paid.description ?? null,
      outstandingAmount: paid.amount, preselected: false,
    };
    lines.push(new PayoutLine(rebuilt, true, paid.amount));
  });

  return lines;
}

/** Sum of the ticked lines; offsets reduce it. */
export function payoutTotal(lines: PayoutLine[]): number {
  return lines.filter(l => l.selected).reduce((total, l) => MathUtils.add(total, Number(l.amount ?? 0)), 0);
}

export function toPayoutLinesPayload(lines: PayoutLine[]): PayoutLinePayload[] {
  return lines.filter(l => l.selected).map(l => ({ source: l.record.source, sourceId: l.record.id, amount: MathUtils.add(Number(l.amount), 0) }));
}

// ═══ Tips ══════════════════════════════════════════════════════════════

/**
 * Even split of a pool tip total, for the distribution preview only; the server's split is final. Works in whole
 * smallest units (10^-afterDecimal) so no rounding drifts: the remainder goes to the first employees picked, one
 * unit each. A negative total (voided payments after a distribution) gives negative shares.
 */
export function splitEvenly(total: number, count: number, afterDecimal: number): number[] {
  if (count <= 0) return [];
  const scale = Math.pow(10, afterDecimal);
  const units = Math.round(Math.abs(total) * scale);
  const base = Math.floor(units / count);
  const remainder = units - base * count;
  const sign = total < 0 ? -1 : 1;
  return Array.from({ length: count }, (_, i) => {
    const share = base + (i < remainder ? 1 : 0);
    return share === 0 ? 0 : (sign * share) / scale;
  });
}
