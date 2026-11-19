import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { PayrollLine } from '../../../services/payroll-run.service';

export interface PayslipData {
  line: PayrollLine;
  /** `2026-11-01 → 2026-11-30`. */
  period: string;
  /** `Draft` or `Finalized`: a draft payslip can still change. */
  status: string;
}

interface Row { labelKey: string; amount: number }

/**
 * One employee's payslip for one run: what was earned, what was taken off and the net, in the order a person reads a payslip.
 * It is drawn from the run line the page already holds, so it can never disagree with the run's own totals. Print uses the
 * browser's print of this sheet only.
 */
@Component({
  selector: 'app-payslip-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent],
  encapsulation: ViewEncapsulation.None,
  template: `
    <app-modal-header [title]="'EMPLOYEES.PAYROLL_RUN.PAYSLIP' | translate"/>
    <div class="psl psl-print">
      <header class="psl__head">
        <div>
          <h3 class="psl__name">{{ data.line.employeeName }}</h3>
          <div class="psl__period">{{ data.period }}</div>
        </div>
        <span class="psl__chip" [class.psl__chip--done]="data.status === 'Finalized'">
          {{ (data.status === 'Finalized' ? 'EMPLOYEES.PAYROLL_RUN.FINALIZED' : 'EMPLOYEES.PAYROLL_RUN.DRAFT') | translate }}
        </span>
      </header>

      @if (data.status !== 'Finalized') {
        <p class="psl__draft">{{ 'EMPLOYEES.PAYROLL_RUN.PAYSLIP_DRAFT_NOTE' | translate }}</p>
      }

      <section class="psl__block">
        <h4 class="psl__title">{{ 'EMPLOYEES.PAYROLL_RUN.PAYSLIP_EARNINGS' | translate }}</h4>
        @for (r of earnings(); track r.labelKey) {
          <div class="psl__row"><span>{{ 'EMPLOYEES.PAYROLL_RUN.' + r.labelKey | translate }}</span><b>{{ r.amount | mycurrency }}</b></div>
        }
        <div class="psl__row psl__row--sum"><span>{{ 'EMPLOYEES.PAYROLL_RUN.GROSS' | translate }}</span><b>{{ res().gross | mycurrency }}</b></div>
      </section>

      <section class="psl__block">
        <h4 class="psl__title">{{ 'EMPLOYEES.PAYROLL_RUN.PAYSLIP_DEDUCTIONS' | translate }}</h4>
        @for (r of deductions(); track r.labelKey) {
          <div class="psl__row"><span>{{ 'EMPLOYEES.PAYROLL_RUN.' + r.labelKey | translate }}</span><b>{{ r.amount | mycurrency }}</b></div>
        } @empty {
          <div class="psl__row psl__row--muted"><span>{{ 'EMPLOYEES.PAYROLL_RUN.PAYSLIP_NO_DEDUCTIONS' | translate }}</span></div>
        }
        <div class="psl__row psl__row--sum"><span>{{ 'EMPLOYEES.PAYROLL_RUN.DEDUCTIONS' | translate }}</span><b>{{ res().totalDeductions | mycurrency }}</b></div>
      </section>

      <div class="psl__net">
        <span>{{ 'EMPLOYEES.PAYROLL_RUN.COL_NET' | translate }}</span>
        <b [class.psl__neg]="res().net < 0">{{ res().net | mycurrency }}</b>
      </div>

      @if (res().gosiEmployer > 0) {
        <p class="psl__note">{{ 'EMPLOYEES.PAYROLL_RUN.PAYSLIP_EMPLOYER_NOTE' | translate }}: {{ res().gosiEmployer | mycurrency }}</p>
      }
      @if (data.line.overrides.notes) {
        <p class="psl__note">{{ data.line.overrides.notes }}</p>
      }
    </div>
    <app-modal-footer>
      <button type="button" class="psl-btn" (click)="ref.close()">{{ 'COMMON.CLOSE' | translate }}</button>
      <button type="button" class="psl-btn psl-btn--primary" (click)="print()">{{ 'COMMON.PRINT' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .psl { padding: 16px 20px; min-width: min(520px, 92vw); display: flex; flex-direction: column; gap: 14px; }
    .psl__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .psl__name { margin: 0; font-size: 18px; font-weight: 700; color: var(--ui-text); }
    .psl__period { font-size: 13px; color: var(--ui-muted); margin-top: 2px; }
    .psl__chip { font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 999px; background: var(--ui-amber-soft); color: var(--ui-amber-text); }
    .psl__chip--done { background: var(--ui-green-soft); color: var(--ui-green-text); }
    .psl__draft { margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--ui-amber-soft); border: 1px solid var(--ui-amber-soft-2); color: var(--ui-amber-text); font-size: 12.5px; }
    .psl__block { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--ui-line); border-radius: 12px; }
    .psl__title { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--ui-muted); }
    .psl__row { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; font-size: 13.5px; color: var(--ui-text-2); }
    .psl__row b { font-variant-numeric: tabular-nums; font-weight: 600; }
    .psl__row--sum { margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--ui-line); font-weight: 700; }
    .psl__row--muted { color: var(--ui-faint); }
    .psl__net { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 14px 16px; border-radius: 12px; background: var(--ui-x-f0fdf4); border: 1px solid var(--ui-x-bbf7d0); }
    .psl__net span { font-weight: 600; color: var(--ui-green-text); }
    .psl__net b { font-size: 22px; color: var(--ui-green-text); font-variant-numeric: tabular-nums; }
    .psl__neg { color: var(--ui-red-text) !important; }
    .psl__note { margin: 0; font-size: 12.5px; color: var(--ui-muted); }
    .psl-btn { padding: 9px 16px; border-radius: 8px; border: 1px solid var(--ui-line-strong); background: var(--ui-surface); color: var(--ui-text-3); font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .psl-btn--primary { border-color: #2691a4; background: var(--ui-b-2691a4); color: #fff; }
    /* Print only the payslip: everything else on the page is hidden. */
    @media print {
      body * { visibility: hidden !important; }
      .psl-print, .psl-print * { visibility: visible !important; }
      .psl-print { position: fixed; inset: 0; background: var(--ui-surface); padding: 24px; }
    }
  `],
})
export class PayslipModalComponent {
  readonly data = inject<PayslipData>(MODAL_DATA);
  readonly ref = inject<ModalRef<void>>(MODAL_REF);

  readonly res = computed(() => this.data.line.result);

  /** Basic always; the other earnings only when there is something in them. */
  readonly earnings = computed<Row[]>(() => {
    const r = this.res();
    const rows: Row[] = [{ labelKey: 'COL_BASIC', amount: r.basicSalary }];
    if (r.allowances) rows.push({ labelKey: 'COL_ALLOW', amount: r.allowances });
    if (r.overtimePay) rows.push({ labelKey: 'PAYSLIP_OVERTIME_PAY', amount: r.overtimePay });
    if (r.bonus) rows.push({ labelKey: 'COL_BONUS', amount: r.bonus });
    return rows;
  });

  readonly deductions = computed<Row[]>(() => {
    const r = this.res();
    const rows: Row[] = [];
    const absence = (r.absenceDeduction || 0) + (r.prorationDeduction || 0);
    if (absence) rows.push({ labelKey: 'COL_ABSENCE_DED', amount: absence });
    if (r.recurringDeductions) rows.push({ labelKey: 'COL_RECURRING', amount: r.recurringDeductions });
    if (r.loanDeduction) rows.push({ labelKey: 'COL_LOAN', amount: r.loanDeduction });
    if (r.gosiEmployee) rows.push({ labelKey: 'COL_GOSI', amount: r.gosiEmployee });
    if (r.otherDeductions) rows.push({ labelKey: 'COL_OTHER', amount: r.otherDeductions });
    return rows;
  });

  print(): void { window.print(); }
}
