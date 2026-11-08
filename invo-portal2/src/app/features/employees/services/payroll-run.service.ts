import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';

/**
 * Company payroll runs — a month's pay from punch attendance, every figure
 * editable.
 *
 * The server does ALL the arithmetic. This service only carries values: it never
 * works out a salary, a deduction or a net, so the screen cannot disagree with
 * what finalizing will store.
 */

export interface PayrollRunSummary {
  id: string;
  status: 'Draft' | 'Finalized';
  periodStart: string;
  periodEnd: string;
  dayDivisor: number;
  employees: number;
  totalNet: number;
  finalizedAt: string | null;
}

/** What one employee's line was calculated from (the "computed" side). */
export interface PayrollLineInputs {
  currency: string;
  dayDivisor: number;
  basicSalary: number;
  allowances: number;
  recurringDeductions: number;
  workingDays: number;
  workedOnWorkingDays: number;
  attendanceDays: number;
  unpaidLeaveDays: number;
  notEmployedDays: number;
  attendanceTracked: boolean;
  overtimeHours: number;
  hourlyRate: number;
  overtimeMultiplier: number;
  loanInstalment: number;
  info?: {
    socialInsuranceApplicable: boolean;
    paymentMethod: string | null;
    hasPayRecord: boolean;
    daysWithPunch: number;
    leavePaidDays: number;
  };
}

/** The user's typed-over figures. Only keys that were overridden are present. */
export interface PayrollOverrides {
  basicSalary?: number | null;
  allowances?: number | null;
  attendanceDays?: number | null;
  overtimeHours?: number | null;
  bonus?: number | null;
  recurringDeductions?: number | null;
  loanDeduction?: number | null;
  otherDeductions?: number | null;
  notes?: string | null;
}

export type PayrollFlag = 'noAttendance' | 'negativeNet' | 'noSalary';

/** The effective figures: override ?? computed. */
export interface PayrollLineResult {
  basicSalary: number;
  allowances: number;
  standingSalary: number;
  dailyRate: number;
  attendanceDays: number;
  workingDays: number;
  absentDays: number;
  unpaidLeaveDays: number;
  notEmployedDays: number;
  deductionDays: number;
  absenceDeduction: number;
  prorationDeduction: number;
  overtimeHours: number;
  overtimePay: number;
  bonus: number;
  recurringDeductions: number;
  loanDeduction: number;
  otherDeductions: number;
  gross: number;
  totalDeductions: number;
  net: number;
  overridden: string[];
  flags: PayrollFlag[];
}

export interface PayrollLine {
  employeeId: string;
  employeeName: string;
  currency: string | null;
  inputs: PayrollLineInputs;
  overrides: PayrollOverrides;
  result: PayrollLineResult;
}

export interface PayrollRunDetail extends Omit<PayrollRunSummary, 'employees' | 'totalNet'> {
  notes: string | null;
  lines: PayrollLine[];
}

@Injectable({ providedIn: 'root' })
export class PayrollRunService {
  private api = inject(ApiService);

  private async call<T>(req: any, fallback: string): Promise<T> {
    const res = await this.api.request<any>(req);
    if (res?.success === false) throw new Error(res?.msg || fallback);
    return res?.data as T;
  }

  async list(): Promise<PayrollRunSummary[]> {
    const rows = await this.call<any[]>(this.api.get('employee/payrollRuns'), 'Could not load payroll runs');
    return (rows ?? []).map(r => ({ ...r, totalNet: Number(r.totalNet ?? 0), employees: Number(r.employees ?? 0) }));
  }

  get(id: string): Promise<PayrollRunDetail> {
    return this.call<PayrollRunDetail>(this.api.get(`employee/getPayrollRun/${id}`), 'Could not load the payroll run');
  }

  create(month: string, dayDivisor: number): Promise<{ id: string; employees: number }> {
    return this.call(this.api.post('employee/createPayrollRun', { month, dayDivisor }), 'Could not create the payroll run');
  }

  /** Save what the user typed for one employee. `null` clears an override. */
  saveLine(runId: string, employeeId: string, overrides: PayrollOverrides): Promise<PayrollLineResult> {
    return this.call(this.api.post('employee/savePayrollRunLine', { runId, employeeId, overrides }), 'Could not save');
  }

  async recalculate(runId: string): Promise<void> {
    await this.call(this.api.post('employee/recalculatePayrollRun', { runId }), 'Could not recalculate');
  }

  async finalize(runId: string): Promise<void> {
    await this.call(this.api.post('employee/finalizePayrollRun', { runId }), 'Could not finalize');
  }

  async remove(runId: string): Promise<void> {
    await this.call(this.api.get(`employee/deletePayrollRun/${runId}`), 'Could not delete');
  }
}
