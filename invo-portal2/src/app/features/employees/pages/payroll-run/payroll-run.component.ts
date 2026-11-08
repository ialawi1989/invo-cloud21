import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ToastService } from '@shared/components/toast/toast.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import {
  PayrollLine,
  PayrollOverrides,
  PayrollRunDetail,
  PayrollRunService,
  PayrollRunSummary,
} from '../../services/payroll-run.service';

type EditableKey =
  | 'basicSalary' | 'allowances' | 'attendanceDays' | 'overtimeHours'
  | 'bonus' | 'recurringDeductions' | 'loanDeduction' | 'gosiEmployee' | 'otherDeductions';

interface Col {
  key: EditableKey;
  labelKey: string;
  /** The calculated value, shown as the placeholder and used to detect a real change. */
  computed: (l: PayrollLine) => number;
  /** The effective value (override ?? computed). */
  value: (l: PayrollLine) => number;
  step: string;
  /**
   * Comes from punches, so it is SHOWN as plain text and overridden in its own
   * column beside it — the calculated figure never gets typed over in place.
   */
  auto?: boolean;
}

/**
 * Employees → Payroll.
 *
 * A list of payroll runs, and (with `?run=<id>`) one run as an editable table.
 * The server does all the arithmetic; this screen shows the calculated figures,
 * lets the user type over the ones that may be overridden, and shows the result
 * the server sends back. Nothing here works out a net.
 */
@Component({
  selector: 'app-payroll-run',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payroll-run.component.html',
  styleUrls: ['./payroll-run.component.scss'],
})
export class PayrollRunComponent {
  private service = inject(PayrollRunService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  readonly runs = signal<PayrollRunSummary[]>([]);
  readonly run = signal<PayrollRunDetail | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  /** `employeeId:key` of the cell being saved, for a subtle saving state. */
  readonly saving = signal<string | null>(null);

  // New-run form.
  readonly newMonth = signal(this.defaultMonth());
  readonly newDivisor = signal(30);

  readonly isDraft = computed(() => this.run()?.status === 'Draft');

  readonly cols: Col[] = [
    { key: 'basicSalary', labelKey: 'COL_BASIC', step: '0.001',
      computed: l => l.inputs.basicSalary, value: l => l.result.basicSalary },
    { key: 'allowances', labelKey: 'COL_ALLOW', step: '0.001',
      computed: l => l.inputs.allowances, value: l => l.result.allowances },
    { key: 'attendanceDays', labelKey: 'COL_ATTEND', step: '1', auto: true,
      computed: l => l.inputs.attendanceDays, value: l => l.result.attendanceDays },
    { key: 'overtimeHours', labelKey: 'COL_OT', step: '0.25', auto: true,
      computed: l => l.inputs.overtimeHours, value: l => l.result.overtimeHours },
    { key: 'bonus', labelKey: 'COL_BONUS', step: '0.001',
      computed: () => 0, value: l => l.result.bonus },
    { key: 'recurringDeductions', labelKey: 'COL_RECURRING', step: '0.001',
      computed: l => l.inputs.recurringDeductions, value: l => l.result.recurringDeductions },
    { key: 'loanDeduction', labelKey: 'COL_LOAN', step: '0.001',
      computed: l => l.inputs.loanInstalment, value: l => l.result.loanDeduction },
    { key: 'gosiEmployee', labelKey: 'COL_GOSI', step: '0.001',
      computed: l => l.result.gosiEmployeeCalculated, value: l => l.result.gosiEmployee },
    { key: 'otherDeductions', labelKey: 'COL_OTHER', step: '0.001',
      computed: () => 0, value: l => l.result.otherDeductions },
  ];

  readonly totals = computed(() => {
    const lines = this.run()?.lines ?? [];
    const sum = (f: (l: PayrollLine) => number) => lines.reduce((s, l) => s + f(l), 0);
    return {
      gross: sum(l => l.result.gross),
      deductions: sum(l => l.result.totalDeductions),
      net: sum(l => l.result.net),
      flagged: lines.filter(l => l.result.flags.length > 0).length,
    };
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
    ];
    const r = this.run();
    items.push(r
      ? { label: this.translate.instant('EMPLOYEES.PAYROLL_RUN.TITLE'), routerLink: '/employees/payroll-run' }
      : { label: this.translate.instant('EMPLOYEES.PAYROLL_RUN.TITLE') });
    if (r) items.push({ label: this.periodLabel(r) });
    return items;
  });

  constructor() {
    withTranslations('employees');
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(q => void this.open(q.get('run')));
  }

  private defaultMonth(): string {
    // Last month: payroll is run after the month has ended.
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private t = (k: string, p?: object) => this.translate.instant('EMPLOYEES.PAYROLL_RUN.' + k, p);

  periodLabel(r: { periodStart: string; periodEnd: string }): string {
    return `${r.periodStart} → ${r.periodEnd}`;
  }

  private async open(id: string | null): Promise<void> {
    this.loading.set(true);
    try {
      if (id) {
        this.run.set(await this.service.get(id));
      } else {
        this.run.set(null);
        this.runs.set(await this.service.list());
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      this.run.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  openRun(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { run: id } });
  }

  back(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { run: null } });
  }

  async createRun(): Promise<void> {
    this.busy.set(true);
    try {
      const made = await this.service.create(this.newMonth(), Number(this.newDivisor()));
      this.openRun(made.id);
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.busy.set(false);
    }
  }

  private async confirm(title: string, message: string, confirm: string, danger = false): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm', data: { title, message, confirm, danger },
    });
    return !!(await ref.afterClosed());
  }

  async deleteRun(r: PayrollRunSummary): Promise<void> {
    if (!(await this.confirm(this.t('DELETE'), this.t('DELETE_CONFIRM'), this.translate.instant('COMMON.DELETE'), true))) return;
    try {
      await this.service.remove(r.id);
      this.runs.set(await this.service.list());
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  async recalculate(): Promise<void> {
    const r = this.run();
    if (!r) return;
    this.busy.set(true);
    try {
      await this.service.recalculate(r.id);
      this.run.set(await this.service.get(r.id));
      this.toast.success(this.t('RECALCULATED'));
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.busy.set(false);
    }
  }

  async finalize(): Promise<void> {
    const r = this.run();
    if (!r) return;
    if (!(await this.confirm(this.t('FINALIZE'), this.t('FINALIZE_CONFIRM'), this.t('FINALIZE')))) return;
    this.busy.set(true);
    try {
      await this.service.finalize(r.id);
      this.run.set(await this.service.get(r.id));
      this.toast.success(this.t('FINALIZED_DONE'));
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.busy.set(false);
    }
  }

  // ── Editing a cell ───────────────────────────────────────────────────────

  isOverridden(l: PayrollLine, c: Col): boolean {
    return l.result.overridden.includes(c.key);
  }

  /**
   * A cell was edited. An empty box clears the override (back to the computed
   * value); a number sets it. Nothing is sent when the typed value is just the
   * computed one on a cell that was never overridden.
   */
  async onCell(l: PayrollLine, c: Col, raw: string): Promise<void> {
    if (!this.isDraft()) return;
    const text = raw.trim();
    let value: number | null;
    if (text === '') value = null;
    else {
      value = Number(text);
      if (!isFinite(value) || value < 0) { this.refreshLine(l); return; }
    }
    if (value === null && !this.isOverridden(l, c)) return;
    if (value !== null && !this.isOverridden(l, c) && value === c.computed(l)) return;
    await this.save(l, { [c.key]: value } as PayrollOverrides, c.key);
  }

  async onNotes(l: PayrollLine, raw: string): Promise<void> {
    if (!this.isDraft()) return;
    const notes = raw.trim() || null;
    if ((l.overrides.notes ?? null) === notes) return;
    await this.save(l, { notes }, 'notes');
  }

  private async save(l: PayrollLine, patch: PayrollOverrides, key: string): Promise<void> {
    const runId = this.run()?.id;
    if (!runId) return;
    this.saving.set(`${l.employeeId}:${key}`);
    try {
      const result = await this.service.saveLine(runId, l.employeeId, patch);
      const overrides: PayrollOverrides = { ...l.overrides };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete (overrides as any)[k]; else (overrides as any)[k] = v;
      }
      this.replaceLine({ ...l, overrides, result });
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      this.refreshLine(l);
    } finally {
      this.saving.set(null);
    }
  }

  /** Put a line back as it was, so a rejected edit does not leave typed text behind. */
  private refreshLine(l: PayrollLine): void { this.replaceLine({ ...l }); }

  private replaceLine(next: PayrollLine): void {
    const r = this.run();
    if (!r) return;
    this.run.set({ ...r, lines: r.lines.map(x => x.employeeId === next.employeeId ? next : x) });
  }

  flagLabel(f: string): string { return this.t('FLAG_' + f.toUpperCase()); }

  /** Why GOSI was not calculated for this person, or '' when it was. */
  gosiNote(l: PayrollLine): string {
    const r = l.result.gosiReason;
    return r ? this.t('GOSI_REASON_' + r.toUpperCase()) : '';
  }

  statusLabel(s: string): string { return this.t(s === 'Finalized' ? 'FINALIZED' : 'DRAFT'); }

  // ── Export ───────────────────────────────────────────────────────────────

  exportCsv(): void {
    const r = this.run();
    if (!r) return;
    const head = ['Employee', 'Currency', 'Basic', 'Allowances', 'Attendance days', 'Working days', 'Absent days',
      'Unpaid leave days', 'Not employed days', 'Absence deduction', 'Proration deduction', 'Overtime hours',
      'Overtime pay', 'Bonus', 'Recurring deductions', 'Loan', 'GOSI (employee)', 'GOSI (employer)', 'Other deductions', 'Gross', 'Total deductions',
      'Net', 'Notes'];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = r.lines.map(l => {
      const x = l.result;
      return [l.employeeName, l.currency ?? '', x.basicSalary, x.allowances, x.attendanceDays, x.workingDays,
        x.absentDays, x.unpaidLeaveDays, x.notEmployedDays, x.absenceDeduction, x.prorationDeduction,
        x.overtimeHours, x.overtimePay, x.bonus, x.recurringDeductions, x.loanDeduction, x.gosiEmployee, x.gosiEmployer, x.otherDeductions,
        x.gross, x.totalDeductions, x.net, l.overrides.notes ?? ''].map(esc).join(',');
    });
    const blob = new Blob(['﻿' + [head.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${r.periodStart}_${r.periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
