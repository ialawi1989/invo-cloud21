import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DatePickerComponent } from '@shared/components/datepicker';

export interface ApproveAccessData {
  employeeName: string;
  page: string;
}

/** Result: `grantedUntil` is an ISO string, or null for "no end date". */
export interface ApproveAccessResult {
  grantedUntil: string | null;
}

type Period = '1d' | '7d' | '30d' | 'custom' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Approve an access request and choose how long the access lasts. */
@Component({
  selector: 'app-approve-access-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, SegmentedToggleComponent, DatePickerComponent],
  template: `
    <app-modal-header [title]="'EMPLOYEES.ACCESS_REQUESTS.APPROVE_TITLE' | translate" />

    <div class="body">
      <p class="msg">{{ 'EMPLOYEES.ACCESS_REQUESTS.APPROVE_MSG' | translate: { name: data.employeeName, page: data.page } }}</p>

      <label class="lbl">{{ 'EMPLOYEES.ACCESS_REQUESTS.PERIOD' | translate }}</label>
      <app-segmented-toggle
        [options]="options"
        [value]="period()"
        size="sm"
        (valueChange)="period.set($any($event))" />

      @if (period() === 'custom') {
        <label class="lbl">{{ 'EMPLOYEES.ACCESS_REQUESTS.UNTIL' | translate }}</label>
        <app-date-picker
          [value]="customDate()"
          (valueChange)="customDate.set($any($event))"
          [min]="today"
          [showTime]="true" />
      }

      <p class="hint" [class.hint--error]="pastCustom()">
        @if (pastCustom()) {
          {{ 'EMPLOYEES.ACCESS_REQUESTS.PAST_ERROR' | translate }}
        } @else if (until(); as u) {
          {{ 'EMPLOYEES.ACCESS_REQUESTS.ENDS_ON' | translate }} <b>{{ u | date: 'medium' }}</b>
        } @else if (period() === 'none') {
          {{ 'EMPLOYEES.ACCESS_REQUESTS.NO_END_HINT' | translate }}
        }
      </p>
      <p class="note">{{ 'EMPLOYEES.ACCESS_REQUESTS.APPLY_NOTE' | translate }}</p>
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button class="btn-confirm" [disabled]="!valid()" (click)="submit()">
        {{ 'EMPLOYEES.ACCESS_REQUESTS.APPROVE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 20px 24px; display: flex; flex-direction: column; gap: 10px; }
    .msg  { font-size: 14px; color: #374151; margin: 0 0 4px; line-height: 1.6; }
    .lbl  { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 6px; }
    .hint { font-size: 13px; color: #475569; margin: 4px 0 0; min-height: 18px; }
    .hint--error { color: #dc2626; }
    .note { font-size: 12px; color: #94a3b8; margin: 0; }
    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
    }
    .btn-confirm {
      padding: 9px 24px; background: #32acc1; color: #fff; border: none;
      border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-confirm:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class ApproveAccessModalComponent {
  readonly data = inject<ApproveAccessData>(MODAL_DATA);
  readonly ref  = inject<{ close(r?: ApproveAccessResult): void; dismiss(): void }>(MODAL_REF);

  readonly options = [
    { value: '1d',     label: 'EMPLOYEES.ACCESS_REQUESTS.P_1D' },
    { value: '7d',     label: 'EMPLOYEES.ACCESS_REQUESTS.P_7D' },
    { value: '30d',    label: 'EMPLOYEES.ACCESS_REQUESTS.P_30D' },
    { value: 'custom', label: 'EMPLOYEES.ACCESS_REQUESTS.P_CUSTOM' },
    { value: 'none',   label: 'EMPLOYEES.ACCESS_REQUESTS.P_NONE' },
  ];

  readonly period = signal<Period>('7d');
  readonly customDate = signal<Date | null>(null);
  /** Earliest pickable day: today (a later time today is still valid). */
  readonly today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  /** End instant for the chosen period; null when open-ended or not yet picked. */
  readonly until = computed<Date | null>(() => {
    switch (this.period()) {
      case '1d':     return new Date(Date.now() + DAY_MS);
      case '7d':     return new Date(Date.now() + 7 * DAY_MS);
      case '30d':    return new Date(Date.now() + 30 * DAY_MS);
      case 'custom': return this.customDate();
      default:       return null;
    }
  });

  /** A custom date is chosen but is not in the future. */
  readonly pastCustom = computed(() => this.period() === 'custom' && !!this.customDate() && !this.valid());

  readonly valid = computed(() => this.period() === 'none' || (this.until()?.getTime() ?? 0) > Date.now());

  submit(): void {
    if (!this.valid()) return;
    this.ref.close({ grantedUntil: this.until()?.toISOString() ?? null });
  }
}
