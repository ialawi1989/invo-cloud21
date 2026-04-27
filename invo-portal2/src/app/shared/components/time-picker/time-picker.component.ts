import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

type Meridiem = 'AM' | 'PM';

/**
 * TimePickerComponent
 * ───────────────────
 * Drop-in replacement for `<input type="time">`. Same `HH:mm` (24-hour)
 * value contract — implements ControlValueAccessor so it works with
 * `formControlName`, `[(ngModel)]`, and `[formControl]`.
 *
 * Visual: matches the project's date picker — same trigger size, same
 * panel theme (white card, brand accents, slate text). Opens a stepper
 * popover *below* the trigger via CDK overlay. No modal.
 *
 * The popover holds two steppers (hour / minute), an AM/PM toggle, a
 * live preview, and OK / Cancel buttons. OK commits to `HH:mm`;
 * Cancel / outside-click discards.
 */
@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule, OverlayModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
})
export class TimePickerComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  // ─── Inputs ────────────────────────────────────────────────────────────
  /** Minute step for the stepper (default 5). */
  step = input<number>(5);

  /** Show the picker as `disabled` (matches `FormControl.disable()`). */
  disabledInput = input<boolean>(false, { alias: 'disabled' });

  /** Show error styling on the trigger. */
  invalid = input<boolean>(false);

  /** Trigger placeholder when nothing is selected. */
  placeholder = input<string>('—');

  // ─── State ─────────────────────────────────────────────────────────────
  /** Current committed value in `HH:mm` (24h). Empty = no time picked. */
  value = signal<string>('');

  /** Working copy of hour while the popover is open. */
  hour12 = signal<number>(12);
  /** Working copy of minute while the popover is open. */
  minute = signal<number>(0);
  /** Working copy of meridiem while the popover is open. */
  meridiem = signal<Meridiem>('PM');

  /** True while the popover is mounted. */
  isOpen = signal<boolean>(false);

  /** CVA-set disabled state. */
  cvaDisabled = signal<boolean>(false);

  /** True when either the explicit input or the CVA flag say disabled. */
  isDisabled = computed(() => this.disabledInput() || this.cvaDisabled());

  /** Trigger element — used for width measurements (popover sizing). */
  triggerEl = viewChild<ElementRef<HTMLElement>>('trigger');

  // ─── CVA plumbing ──────────────────────────────────────────────────────
  private _onChange: (v: string) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(v: string | null | undefined): void {
    this.value.set((v ?? '').trim());
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
    this.cdr.markForCheck();
  }

  // ─── Display ───────────────────────────────────────────────────────────
  /** Trigger label — e.g. "07:00 AM" or `placeholder()` when empty. */
  displayLabel = computed<string>(() => {
    const v = this.value();
    if (!v) return this.placeholder();
    const { hour12, minute, meridiem } = parse24h(v);
    return `${pad2(hour12)}:${pad2(minute)} ${meridiem}`;
  });

  hasValue = computed<boolean>(() => !!this.value());

  /** Display strings for the stepper while the popover is open. */
  hourLabel    = computed<string>(() => pad2(this.hour12()));
  minuteLabel  = computed<string>(() => pad2(this.minute()));
  preview      = computed<string>(() => `${this.hourLabel()}:${this.minuteLabel()} ${this.meridiem()}`);

  // ─── Open / close ──────────────────────────────────────────────────────
  toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen() ? this.cancel() : this.open();
  }

  open(): void {
    if (this.isDisabled() || this.isOpen()) return;
    // Snapshot the current committed value into the working stepper state.
    const parsed = parse24h(this.value() || '');
    this.hour12.set(parsed.hour12);
    this.minute.set(snapStep(parsed.minute, clampStep(this.step())));
    this.meridiem.set(parsed.meridiem);
    this.isOpen.set(true);
  }

  /** Cancel — close without committing. */
  cancel(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this._onTouched();
  }

  /** OK — commit the working state and close. */
  ok(): void {
    const next = toHHmm(this.hour12(), this.minute(), this.meridiem());
    if (next !== this.value()) {
      this.value.set(next);
      this._onChange(next);
    }
    this.isOpen.set(false);
    this._onTouched();
  }

  // ─── Stepper actions ───────────────────────────────────────────────────
  hourUp(): void {
    this.hour12.update((h) => {
      const next = h === 12 ? 1 : h + 1;
      // Crossing 11→12 also flips AM/PM, just like a real clock.
      if (h === 11) this.toggleMeridiem();
      return next;
    });
  }

  hourDown(): void {
    this.hour12.update((h) => {
      const next = h === 1 ? 12 : h - 1;
      if (h === 12) this.toggleMeridiem();
      return next;
    });
  }

  minuteUp(): void {
    const step = clampStep(this.step());
    this.minute.update((m) => {
      const next = (m + step) % 60;
      if (m + step >= 60) this.hourUp();
      return next;
    });
  }

  minuteDown(): void {
    const step = clampStep(this.step());
    this.minute.update((m) => {
      const next = m - step;
      if (next < 0) {
        this.hourDown();
        return 60 + next;
      }
      return next;
    });
  }

  setMeridiem(m: Meridiem): void { this.meridiem.set(m); }

  private toggleMeridiem(): void {
    this.meridiem.update((m) => (m === 'AM' ? 'PM' : 'AM'));
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if ((event.key === 'Enter' || event.key === ' ') &&
          document.activeElement === this.triggerEl()?.nativeElement) {
        event.preventDefault();
        this.open();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      this.triggerEl()?.nativeElement.focus();
    }
  }
}

// ─── Free helpers ────────────────────────────────────────────────────────
function pad2(n: number): string { return n < 10 ? '0' + n : String(n); }
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
function clampStep(n: number): number { return clamp(n, 1, 30); }
function snapStep(n: number, step: number): number {
  return (Math.round(n / step) * step) % 60;
}

function parse24h(v: string): { hour12: number; minute: number; meridiem: Meridiem } {
  const [hStr = '12', mStr = '0'] = (v ?? '').split(':');
  const h24 = clamp(parseInt(hStr, 10) || 12, 0, 23);
  const m   = clamp(parseInt(mStr, 10) || 0, 0, 59);
  const meridiem: Meridiem = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = ((h24 + 11) % 12) + 1;
  return { hour12, minute: m, meridiem };
}

function toHHmm(h12: number, m: number, meridiem: Meridiem): string {
  const base = h12 % 12;
  const h24 = meridiem === 'PM' ? base + 12 : base;
  return `${pad2(h24)}:${pad2(m)}`;
}
