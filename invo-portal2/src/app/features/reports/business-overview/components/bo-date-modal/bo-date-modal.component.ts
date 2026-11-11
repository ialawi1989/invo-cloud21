import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DatePreset, DateRange } from '@shared/components/datepicker/date-picker.types';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { toIso } from '../../../utils/report-period.util';

export interface BoDateModalData {
  /** Current mode + dates (ISO). */
  asOf: boolean;
  from: string;
  to: string;
  /** Show the "As of" checkbox (the report can switch between one date and a range). */
  asOfOptional: boolean;
  presets: DatePreset[];
}
export interface BoDateModalResult { asOf: boolean; from: string; to: string; }

/**
 * Date picker as a modal, for phones (the popover is cramped there). Like the legacy "Select Date Range" dialog:
 * presets, calendar and the "As of" checkbox edit a draft; nothing changes until Apply.
 */
@Component({
  selector: 'app-bo-date-modal',
  standalone: true,
  imports: [TranslateModule, DatePickerComponent],
  templateUrl: './bo-date-modal.component.html',
  styles: [`:host { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; height: 100%; }`],
})
export class BoDateModalComponent {
  private ref = inject(MODAL_REF) as ModalRef<BoDateModalResult | undefined>;
  readonly data = inject(MODAL_DATA) as BoDateModalData;

  asOf = signal(this.data.asOf);
  private range = signal<DateRange>({
    start: new Date(this.data.from + 'T00:00:00'), end: new Date(this.data.to + 'T00:00:00'),
  });
  private single = signal<Date>(new Date(this.data.to + 'T00:00:00'));

  value = computed<Date | DateRange>(() => (this.asOf() ? this.single() : this.range()));
  canApply = computed(() => this.asOf() ? !!this.single() : !!(this.range().start && this.range().end));

  onValue(v: Date | DateRange | null): void {
    if (!v) return;
    if (this.asOf()) this.single.set(v as Date);
    else this.range.set(v as DateRange);
  }

  /** Switching to a range starts from the month of the picked date (as in the desktop popover). */
  setAsOf(checked: boolean): void {
    if (checked === this.asOf()) return;
    if (!checked) {
      const d = this.single();
      this.range.set({ start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) });
    } else if (this.range().end) {
      this.single.set(this.range().end!);
    }
    this.asOf.set(checked);
  }

  cancel(): void { this.ref.dismiss(); }

  apply(): void {
    if (!this.canApply()) return;
    if (this.asOf()) {
      this.ref.close({ asOf: true, from: this.data.from, to: toIso(this.single()) });
    } else {
      const r = this.range();
      this.ref.close({ asOf: false, from: toIso(r.start!), to: toIso(r.end!) });
    }
  }
}
