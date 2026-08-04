import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';

export interface QuickAdjustData {
  /** Modal title. */
  title: string;
  /** Which columns to expose. Show both for the bulk "range" flow. */
  showIn:  boolean;
  showOut: boolean;
  /** Seed values (adjusted, or the recorded time) for each shown field. */
  valueIn:  Date | null;
  valueOut: Date | null;
}

export interface QuickAdjustResult {
  /** Picked clock-in date+time (or `null` to clear). */
  in:  Date | null;
  /** Picked clock-out date+time (or `null` to clear). */
  out: Date | null;
}

/**
 * attendance-quick-adjust-modal
 * ─────────────────────────────
 * Adjust attendance times without leaving the list. Shows a single
 * clock-in OR clock-out field (per-row quick edit), or BOTH as a
 * from → to range (bulk edit across selected rows). Returns the picked
 * `Date`s (or `null` to clear); the caller persists them.
 */
@Component({
  selector: 'app-attendance-quick-adjust-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    DatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="data.title" />

    <div class="body">
      <div class="range" [class.range--pair]="data.showIn && data.showOut">
        @if (data.showIn) {
          <div class="field">
            <label class="lbl">{{ 'EMPLOYEES.ATTENDANCE.CLOCKED_IN' | translate }}</label>
            <app-date-picker
              mode="single" [showTime]="true" [horizontalTime]="true"
              [value]="inValue()"
              [placeholder]="'EMPLOYEES.ATTENDANCE.CLOCKED_IN' | translate"
              (valueChange)="inValue.set($any($event))" />
          </div>
        }

        @if (data.showIn && data.showOut) { <span class="arrow" aria-hidden="true">→</span> }

        @if (data.showOut) {
          <div class="field">
            <label class="lbl">{{ 'EMPLOYEES.ATTENDANCE.CLOCKED_OUT' | translate }}</label>
            <app-date-picker
              mode="single" [showTime]="true" [horizontalTime]="true"
              [min]="inValue()"
              [value]="outValue()"
              [placeholder]="'EMPLOYEES.ATTENDANCE.CLOCKED_OUT' | translate"
              (valueChange)="outValue.set($any($event))" />
          </div>
        }
      </div>

      @if (data.showIn && data.showOut) {
        <p class="hint">{{ 'EMPLOYEES.ATTENDANCE.BULK_HINT' | translate }}</p>
      }
    </div>

    <app-modal-footer>
      <button type="button" class="btn-ghost" (click)="clearAll()">
        {{ 'COMMON.CLEAR' | translate }}
      </button>
      <span class="spacer"></span>
      <button type="button" class="btn-cancel" (click)="cancel()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn-save" [disabled]="!canSave()" (click)="save()">
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 16px; }
    .range { display: flex; flex-direction: column; gap: 12px; }
    .range--pair {
      flex-direction: row; align-items: flex-end; gap: 10px;
      @media (max-width: 480px) { flex-direction: column; align-items: stretch; .arrow { display: none; } }
    }
    .field { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .lbl { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
    .arrow { padding-bottom: 8px; color: #94a3b8; font-size: 18px; }
    .hint { margin: 12px 0 0; font-size: 12px; color: #94a3b8; }
    .spacer { flex: 1; }
    .btn-ghost, .btn-cancel {
      padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
      background: #fff; border: 1px solid #e5e7eb; color: #475569; cursor: pointer;
      &:hover { background: #f8fafc; }
    }
    .btn-save {
      padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: var(--color-brand-600, #2691a4); color: #fff; border: none; cursor: pointer;
      &:hover { background: var(--color-brand-700, #207484); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `],
})
export class AttendanceQuickAdjustModalComponent {
  data = inject<QuickAdjustData>(MODAL_DATA);
  private ref = inject<ModalRef<QuickAdjustResult>>(MODAL_REF);

  inValue  = signal<Date | null>(this.data.valueIn  ?? null);
  outValue = signal<Date | null>(this.data.valueOut ?? null);

  /** In bulk (both) mode at least one field must be set; single mode is
   *  always saveable (empty = clear the adjustment). */
  canSave = computed(() =>
    !(this.data.showIn && this.data.showOut) || this.inValue() != null || this.outValue() != null,
  );

  clearAll(): void { this.inValue.set(null); this.outValue.set(null); }
  save(): void { this.ref.close({ in: this.inValue(), out: this.outValue() }); }
  cancel(): void { this.ref.dismiss(); }
}
