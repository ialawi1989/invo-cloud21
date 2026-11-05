import { ChangeDetectionStrategy, Component, computed, forwardRef, input, model, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { DatePickerComponent } from '../datepicker/date-picker.component';
import { toDateOnly, toIsoDateOnly } from '@shared/utils';

/**
 * <app-date-field>
 * ────────────────
 * The app's custom date picker, speaking `'yyyy-MM-dd'` strings.
 *
 * Forms that store a date as an ISO string (every HR form) can swap a native
 * `<input type="date">` for this one without touching their value handling:
 *
 *   <app-date-field formControlName="startDate"/>
 *   <app-date-field [value]="rec.lastWorkingDay" (valueChange)="…"/>
 *
 * `changed` fires AFTER the form control has taken the new value, for callers
 * that recompute something from it (the native `(change)` event's equivalent).
 */
@Component({
  selector: 'app-date-field',
  standalone: true,
  imports: [DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateFieldComponent), multi: true }],
  template: `
    <app-date-picker
      [triggerClass]="triggerClass()"
      [value]="date()"
      [min]="minDate()"
      [max]="maxDate()"
      [disabled]="disabled() || cvaDisabled()"
      (valueChange)="onPick($any($event))"/>
  `,
  styles: [`:host { display: block; min-width: 0; }`],
})
export class DateFieldComponent implements ControlValueAccessor {
  /** ISO `yyyy-MM-dd`, or null. */
  readonly value = model<string | null>(null);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly disabled = input<boolean>(false);
  /** Class on the trigger button; HR tabs style `form-control`, the GOSI page `input`. */
  readonly triggerClass = input<string>('form-control');
  readonly changed = output<string | null>();

  protected readonly cvaDisabled = signal(false);
  protected readonly date = computed(() => toDateOnly(this.value()));
  protected readonly minDate = computed(() => toDateOnly(this.min()));
  protected readonly maxDate = computed(() => toDateOnly(this.max()));

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  onPick(d: Date | null): void {
    const iso = toIsoDateOnly(d);
    if (iso === this.value()) return;
    this.value.set(iso);
    this.onChange(iso);
    this.onTouched();
    this.changed.emit(iso);
  }

  writeValue(v: string | null): void { this.value.set(v || null); }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.cvaDisabled.set(isDisabled); }
}
