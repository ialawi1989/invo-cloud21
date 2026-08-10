import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';

/**
 * Payroll, bank details and loans.
 *
 * ── EVERY MONEY FIELD ON THIS SCREEN IS A POSTGRES numeric ───────────────────
 * node-postgres returns `numeric` as a STRING. `basicSalary`, `grossSalary`,
 * `recurringDeductions`, `netBeforeStatutory`, and a loan's `amount`,
 * `repaidAmount`, `instalment` and `balance` all arrive as `"1250.000"`.
 *
 * A `typeof v === 'number'` guard would discard every one of them and render
 * the whole screen as unknown — and that failure is nastier than a crash,
 * because the unknown state was built deliberately and looks exactly like the
 * server having sent nothing. Someone would go looking at the API before
 * looking at the mapper. Hence `num()` on every numeric field, tested directly.
 *
 * ── netBeforeStatutory IS NOT TAKE-HOME PAY ──────────────────────────────────
 * The server says so twice — `statutoryDeductionsIncluded: false` on every pay
 * row and `statutoryCalculationsAvailable: false` on the catalogue — because
 * gratuity, GOSI and WPS are deliberately unimplemented pending open question
 * 3. Guessing them would be worse than omitting: a wrong gratuity figure is an
 * underpayment on the day someone leaves, and it looks authoritative all the
 * way to the bank transfer.
 *
 * The flags are read from the response rather than assumed, so the day the
 * calculations land the disclaimers stop without a redeploy.
 *
 * ── A PAY CHANGE IS A NEW ROW, NOT AN EDIT ───────────────────────────────────
 * There is no update method, here or on the server. Each change is a new
 * effective-dated row so "what were they paid in March" stays answerable after
 * April's rise, and `changeReason` is required — a pay history with no reasons
 * cannot answer "was this a promotion or a correction", which is where every
 * pay-equity review and every dispute starts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PayComponent {
  type: string | null;
  direction: string | null;
  amount: number | null;
  /** `Fixed` or `PercentOfBasic`. A percent is 25 for 25%, never 0.25. */
  calculation: string | null;
  isRecurring: boolean | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface PayrollRow {
  id: string;
  employeeId: string;
  effectiveFrom: string | null;
  basicSalary: number | null;
  currency: string | null;
  payFrequency: string | null;
  changeReason: string | null;
  changeNote: string | null;
  paymentMethod: string | null;
  socialInsuranceApplicable: boolean | null;
  wpsEnabled: boolean | null;
  gosiNumber: string | null;
  components: PayComponent[];

  /** Computed on read from the components active on the day asked about. */
  grossSalary: number | null;
  recurringDeductions: number | null;
  /**
   * Gross minus recurring deductions.
   *
   * **NOT net pay.** Social insurance and end-of-service are not calculated.
   * See `statutoryDeductionsIncluded`, which the server sets to false on every
   * row precisely so this cannot be mistaken for take-home.
   */
  netBeforeStatutory: number | null;
  statutoryDeductionsIncluded: boolean | null;

  /** Sent on history rows only. Which row is in force, and which is scheduled. */
  isCurrent: boolean | null;
  isFuture: boolean | null;
}

export interface SplitAccount {
  bankName: string | null;
  iban: string | null;
  percentage: number | null;
}

export interface BankDetails {
  id: string;
  bankName: string | null;
  iban: string | null;
  swift: string | null;
  accountHolderName: string | null;
  splitAccounts: SplitAccount[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  amount: number | null;
  currency: string | null;
  instalment: number | null;
  startDate: string | null;
  repaidAmount: number | null;
  /** Amount minus repaid, never negative. Computed on read. */
  balance: number | null;
  isSettled: boolean | null;
  notes: string | null;
}

export interface PayrollCatalog {
  frequencies: { key: string; labelKey: string; perYear: number }[];
  paymentMethods: { key: string; labelKey: string; needsBank: boolean }[];
  changeReasons: { key: string; labelKey: string }[];
  componentTypes: { key: string; labelKey: string; direction: string }[];
  calculationMethods: string[];
  /**
   * False today. Gratuity, GOSI and WPS are not implemented (open question 3).
   *
   * Defaults to FALSE when absent — assume the calculations are missing and
   * keep disclaiming. Assuming the other way would present a partial figure as
   * a complete one.
   */
  statutoryCalculationsAvailable: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmployeePayrollService {
  private api = inject(ApiService);

  // ─── Pay ───────────────────────────────────────────────────────────────

  /** The row in force on a given day — today unless asked otherwise. */
  async current(employeeId: string, asOf?: string): Promise<PayrollRow | null> {
    const query = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
    const res = await this.api.request<any>(this.api.get(`employee/getPayroll/${employeeId}${query}`));
    if (res?.success === false || !res?.data) return null;
    return this.mapPay(res.data);
  }

  /** Every row, newest first, each flagged `isCurrent` / `isFuture`. */
  async history(employeeId: string): Promise<PayrollRow[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getPayrollHistory/${employeeId}`));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapPay(r));
  }

  /**
   * Record a pay change.
   *
   * Named `recordChange`, not `save`: there is no update path. Every call
   * inserts a new effective-dated row.
   */
  async recordChange(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/savePayroll', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not record the pay change');
    return { id: res?.data?.id ?? '' };
  }

  /** For a mis-entered row. Correcting a figure is a new row, not a delete. */
  async removeRow(payrollId: string): Promise<void> {
    const res = await this.api.request<any>(this.api.get(`employee/deletePayroll/${payrollId}`));
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the row');
  }

  // ─── Bank ──────────────────────────────────────────────────────────────

  async bankDetails(employeeId: string): Promise<BankDetails | null> {
    const res = await this.api.request<any>(this.api.get(`employee/getBankDetails/${employeeId}`));
    if (res?.success === false || !res?.data) return null;
    const d = res.data;
    return {
      id: d?.id ?? '',
      bankName: d?.bankName ?? null,
      iban: d?.iban ?? null,
      swift: d?.swift ?? null,
      accountHolderName: d?.accountHolderName ?? null,
      splitAccounts: Array.isArray(d?.splitAccounts)
        ? d.splitAccounts.map((s: any) => ({
            bankName: s?.bankName ?? null,
            iban: s?.iban ?? null,
            percentage: num(s?.percentage),
          }))
        : [],
      updatedAt: d?.updatedAt ?? null,
      updatedBy: d?.updatedBy ?? null,
    };
  }

  /**
   * Change the account a salary goes to.
   *
   * `editBank` and never `isSelf` on the server — nobody redirects their own
   * salary without someone else's involvement. That is the oldest control in
   * payroll and the reason this is a separate grant from `viewBank`: the fraud
   * is changing an account number, not reading one.
   */
  async saveBankDetails(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveBankDetails', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the bank details');
    return { id: res?.data?.id ?? '' };
  }

  // ─── Loans ─────────────────────────────────────────────────────────────

  async loans(employeeId: string): Promise<EmployeeLoan[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getLoans/${employeeId}`));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapLoan(r));
  }

  async saveLoan(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveLoan', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the loan');
    return { id: res?.data?.id ?? '' };
  }

  async catalog(): Promise<PayrollCatalog> {
    const res = await this.api.request<any>(this.api.get('employee/payrollCatalog'));
    const d = res?.data;
    return {
      frequencies: Array.isArray(d?.frequencies) ? d.frequencies : [],
      paymentMethods: Array.isArray(d?.paymentMethods) ? d.paymentMethods : [],
      changeReasons: Array.isArray(d?.changeReasons) ? d.changeReasons : [],
      componentTypes: Array.isArray(d?.componentTypes) ? d.componentTypes : [],
      calculationMethods: Array.isArray(d?.calculationMethods) ? d.calculationMethods : [],
      // Only an explicit `true` turns the disclaimers off.
      statutoryCalculationsAvailable: d?.statutoryCalculationsAvailable === true,
    };
  }

  // ─── Mapping ───────────────────────────────────────────────────────────

  private mapPay(r: any): PayrollRow {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      effectiveFrom: r?.effectiveFrom ?? null,
      // Every one of these is a numeric arriving as a string.
      basicSalary: num(r?.basicSalary),
      currency: r?.currency ?? null,
      payFrequency: r?.payFrequency ?? null,
      changeReason: r?.changeReason ?? null,
      changeNote: r?.changeNote ?? null,
      paymentMethod: r?.paymentMethod ?? null,
      socialInsuranceApplicable:
        typeof r?.socialInsuranceApplicable === 'boolean' ? r.socialInsuranceApplicable : null,
      wpsEnabled: typeof r?.wpsEnabled === 'boolean' ? r.wpsEnabled : null,
      gosiNumber: r?.gosiNumber ?? null,
      components: Array.isArray(r?.components)
        ? r.components.map((c: any) => ({
            type: c?.type ?? null,
            direction: c?.direction ?? null,
            amount: num(c?.amount),
            calculation: c?.calculation ?? null,
            isRecurring: typeof c?.isRecurring === 'boolean' ? c.isRecurring : null,
            effectiveFrom: c?.effectiveFrom ?? null,
            effectiveTo: c?.effectiveTo ?? null,
          }))
        : [],

      grossSalary: num(r?.grossSalary),
      recurringDeductions: num(r?.recurringDeductions),
      netBeforeStatutory: num(r?.netBeforeStatutory),
      // Defaults to FALSE when absent, not null: the safe reading of silence is
      // that the statutory deductions are NOT in the figure, so the disclaimer
      // stays up. Every other nullable field on this screen defaults to unknown;
      // this one does not, because unknown would render as no disclaimer.
      statutoryDeductionsIncluded: r?.statutoryDeductionsIncluded === true,

      isCurrent: typeof r?.isCurrent === 'boolean' ? r.isCurrent : null,
      isFuture: typeof r?.isFuture === 'boolean' ? r.isFuture : null,
    };
  }

  private mapLoan(r: any): EmployeeLoan {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      amount: num(r?.amount),
      currency: r?.currency ?? null,
      instalment: num(r?.instalment),
      startDate: r?.startDate ?? null,
      repaidAmount: num(r?.repaidAmount),
      balance: num(r?.balance),
      isSettled: typeof r?.isSettled === 'boolean' ? r.isSettled : null,
      notes: r?.notes ?? null,
    };
  }
}

/**
 * A Postgres `numeric` as a number, or null.
 *
 * Exported so it can be tested directly — on this screen it is the difference
 * between a salary and a blank.
 *
 * `null`, `undefined` and `''` all stay null. `'0'` and `0` survive as 0, which
 * matters: a zero deduction is a real figure, not a missing one.
 */
export function num(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}
