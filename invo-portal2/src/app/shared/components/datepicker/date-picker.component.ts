import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import {
  DateRange,
  DatePickerMode,
  DatePickerView,
  DateDisabledPredicate,
  DatePreset,
} from './date-picker.types';
import {
  DEFAULT_DAY_NAMES,
  DEFAULT_MONTH_NAMES,
  DEFAULT_MONTH_NAMES_SHORT,
  addMonths,
  addYears,
  buildCalendarGrid,
  clampDate,
  decadeRange,
  formatDate,
  isAfterDay,
  isBeforeDay,
  isBetweenDays,
  isSameDay,
  isSameMonth,
  rotateDayNames,
  startOfDay,
} from './date-utils';

/**
 * DatePickerComponent
 * ───────────────────
 * Zero-dependency, signal-driven date picker.
 *
 * Modes:
 *   • `single` — picks a single Date.
 *   • `range`  — picks a `{ start, end }` range with hover preview.
 *
 * Views (toggle by clicking the header):
 *   • `days`   — a 6-row month grid (default).
 *   • `months` — month picker (3×4).
 *   • `years`  — 12-year decade picker (3×4).
 *
 * Layout:
 *   • Default — input trigger + popover panel via CDK overlay (body-mounted).
 *   • `[inline]="true"` — calendar is always visible (no trigger).
 *
 * Constraints:
 *   • `[min]`, `[max]` — bounds applied to days/months/years views.
 *   • `[disabledDate]` — predicate for marking specific days unselectable.
 *
 * Two-way binding:
 *   • `[(value)]` — `Date | null` for single, `DateRange | null` for range.
 *
 * No external libraries — all date math lives in `./date-utils.ts`.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, OverlayModule],
  templateUrl: './date-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);
  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** Two-way bound value. `Date | null` for single, `DateRange | null` for range. */
  value = model<Date | DateRange | null>(null);

  /** `'single'` or `'range'`. */
  mode = input<DatePickerMode>('single');

  /** Lower bound (inclusive). */
  min = input<Date | null>(null);

  /** Upper bound (inclusive). */
  max = input<Date | null>(null);

  /** Custom disabled-date predicate. Return `true` to disable a date. */
  disabledDate = input<DateDisabledPredicate | null>(null);

  /** Strftime-ish display pattern for the trigger input. See `date-utils.formatDate`. */
  displayFormat = input<string>('yyyy-MM-dd');

  /** Trigger placeholder when nothing is selected. */
  placeholder = input<string>('Select date');

  /** Render the calendar inline (no trigger / popover). */
  inline = input<boolean>(false);

  /** Sunday = 0, Monday = 1, etc. */
  firstDayOfWeek = input<number>(0);

  /** i18n month names override. */
  monthNames = input<string[]>(DEFAULT_MONTH_NAMES);

  /** i18n short month names override. */
  monthNamesShort = input<string[]>(DEFAULT_MONTH_NAMES_SHORT);

  /** i18n day name override (Sunday-first). */
  dayNames = input<string[]>(DEFAULT_DAY_NAMES);

  /** Show the Clear / Today footer. */
  showFooter = input<boolean>(true);

  /**
   * Show an inline time stepper (HH:MM + AM/PM) at the bottom of the
   * calendar panel. Combined with `mode='single'` this turns the
   * picker into a date+time picker — the bound `Date` carries the
   * picked hour/minute and the trigger label includes them.
   * Range mode ignores this flag.
   */
  showTime = input<boolean>(false);

  /** Minute step the up/down chevrons advance by. Defaults to 5. */
  timeStep = input<number>(5);

  /**
   * Optional quick-pick preset list (e.g. "Today", "Last 7 days"). Rendered
   * as a left sidebar inside the panel when non-empty. Range-mode only —
   * presets are ignored in single mode.
   */
  presets = input<DatePreset[]>([]);

  /**
   * Number of months rendered side-by-side. Defaults to `1`. Useful in range
   * mode to make selecting cross-month spans easier. Mobile (< 640px)
   * automatically collapses to 1 month via CSS.
   */
  monthsShown = input<1 | 2>(1);

  /** Disable trigger interaction. Also set automatically by `setDisabledState` (forms). */
  disabled = input<boolean>(false);

  /** Effective disabled state — true if either the input or the form is disabled. */
  isDisabled = computed(() => this.disabled() || this._cvaDisabled());

  /** Mount the popup into `<body>` via CDK overlay (default) or render it inline as a sibling. */
  attachToBody = input<boolean>(true);

  /** Extra classes to add to the trigger button. */
  triggerClass = input<string>('');

  /** Extra classes to add to the panel (calendar wrapper). */
  panelClass = input<string>('');

  // ── Outputs ────────────────────────────────────────────────────────────────
  opened = output<void>();
  closed = output<void>();

  // ── View children ──────────────────────────────────────────────────────────
  triggerEl = viewChild<ElementRef<HTMLElement>>('trigger');

  // ── Internal state ─────────────────────────────────────────────────────────
  isOpen        = signal<boolean>(false);
  view          = signal<DatePickerView>('days');
  /** The month/year currently being shown — independent of the selected value. */
  cursor        = signal<Date>(startOfDay(new Date()));
  /** First click in range mode, before the second click commits. */
  rangeAnchor   = signal<Date | null>(null);
  /** Hovered cell in range mode (for the live preview). */
  rangeHover    = signal<Date | null>(null);
  triggerWidth  = signal<number>(0);

  // ── Convenience accessors ──────────────────────────────────────────────────
  /** True if `value` is a `DateRange`. */
  isRangeMode = computed(() => this.mode() === 'range');

  /** Current single date or null. */
  singleValue = computed<Date | null>(() => {
    if (this.isRangeMode()) return null;
    const v = this.value();
    return v instanceof Date ? v : null;
  });

  /** Current range or null. */
  rangeValue = computed<DateRange | null>(() => {
    if (!this.isRangeMode()) return null;
    const v = this.value();
    if (v && !(v instanceof Date) && 'start' in v) return v as DateRange;
    return null;
  });

  /** Display label for the trigger. */
  displayLabel = computed<string>(() => {
    const fmt = this.displayFormat();
    const months = this.monthNames();
    const monthsShort = this.monthNamesShort();
    if (this.isRangeMode()) {
      const r = this.rangeValue();
      if (!r || (!r.start && !r.end)) return '';
      const s = r.start ? formatDate(r.start, fmt, months, monthsShort) : '…';
      const e = r.end   ? formatDate(r.end,   fmt, months, monthsShort) : '…';
      return `${s} → ${e}`;
    }
    const single = this.singleValue();
    if (!single) return '';
    const dateStr = formatDate(single, fmt, months, monthsShort);
    if (this.showTime()) {
      const t = this.timePieces();
      return `${dateStr} ${pad2(t.h12)}:${pad2(t.min)} ${t.meridiem}`;
    }
    return dateStr;
  });

  /**
   * Hour (1-12), minute (0-59) and AM/PM derived from the current
   * single value. Falls back to the cursor (or "now") when no value
   * is selected so the stepper has something to show before the
   * user clicks a day.
   */
  timePieces = computed<{ h12: number; min: number; meridiem: 'AM' | 'PM' }>(() => {
    const src = this.singleValue() ?? this.cursor();
    const h24 = src.getHours();
    const meridiem: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const h12 = ((h24 + 11) % 12) + 1;
    return { h12, min: src.getMinutes(), meridiem };
  });

  hasValue = computed<boolean>(() => {
    if (this.isRangeMode()) {
      const r = this.rangeValue();
      return !!r && (!!r.start || !!r.end);
    }
    return this.singleValue() != null;
  });

  // ── Header label (depends on view) ─────────────────────────────────────────
  headerLabel = computed<string>(() => {
    const c = this.cursor();
    const months = this.monthNames();
    if (this.view() === 'days') {
      return `${months[c.getMonth()]} ${c.getFullYear()}`;
    }
    if (this.view() === 'months') {
      return `${c.getFullYear()}`;
    }
    // years view: show the decade range
    const ys = decadeRange(c.getFullYear());
    return `${ys[0]} – ${ys[ys.length - 1]}`;
  });

  // ── Days view data ─────────────────────────────────────────────────────────
  weekdayLabels = computed<string[]>(() =>
    rotateDayNames(this.dayNames(), this.firstDayOfWeek()),
  );

  /**
   * 42 cells = 6 rows × 7 columns for the primary cursor's month.
   */
  dayCells = computed(() => this.buildDayCells(this.cursor()));

  /** Second month's cursor — used when `monthsShown() === 2`. */
  secondCursor = computed<Date>(() => addMonths(this.cursor(), 1));

  /** Second month's day grid (same shape as `dayCells`). */
  secondDayCells = computed(() => this.buildDayCells(this.secondCursor()));

  /** Header label for the second month (always day-view formatting). */
  secondHeaderLabel = computed<string>(() => {
    const c = this.secondCursor();
    return `${this.monthNames()[c.getMonth()]} ${c.getFullYear()}`;
  });

  private buildDayCells(c: Date) {
    const grid = buildCalendarGrid(c.getFullYear(), c.getMonth(), this.firstDayOfWeek());
    const today = new Date();
    const min   = this.min();
    const max   = this.max();
    const disFn = this.disabledDate();
    const single = this.singleValue();
    const range  = this.rangeValue();
    const hover  = this.rangeHover();
    const anchor = this.rangeAnchor();
    const rangeMode = this.isRangeMode();

    return grid.map((date) => {
      const inMonth = date.getMonth() === c.getMonth();
      const isToday = isSameDay(date, today);
      const disabledByMin = !!min && isBeforeDay(date, min);
      const disabledByMax = !!max && isAfterDay(date, max);
      const disabledByFn  = disFn ? disFn(date) : false;
      const disabled = disabledByMin || disabledByMax || disabledByFn;

      // Selection state
      let selected = false;
      let inRange  = false;
      let rangeStart = false;
      let rangeEnd   = false;

      if (rangeMode) {
        const start = anchor ?? range?.start ?? null;
        const end = anchor ? hover : range?.end ?? null;
        if (start && end) {
          const lo = isBeforeDay(start, end) ? start : end;
          const hi = isBeforeDay(start, end) ? end : start;
          inRange = isBetweenDays(date, lo, hi);
          rangeStart = isSameDay(date, lo);
          rangeEnd   = isSameDay(date, hi);
        } else if (start) {
          rangeStart = isSameDay(date, start);
        } else if (range?.end) {
          rangeEnd = isSameDay(date, range.end);
        }
        selected = rangeStart || rangeEnd;
      } else {
        selected = isSameDay(date, single);
      }

      return {
        date,
        inMonth,
        isToday,
        disabled,
        selected,
        inRange,
        rangeStart,
        rangeEnd,
      };
    });
  }

  // ── Months view data ───────────────────────────────────────────────────────
  monthCells = computed(() => {
    const c = this.cursor();
    const min = this.min();
    const max = this.max();
    const months = this.monthNamesShort();
    return months.map((name, idx) => {
      // Disable a month entirely if its last day < min or first day > max.
      const firstDay = new Date(c.getFullYear(), idx, 1);
      const lastDay  = new Date(c.getFullYear(), idx + 1, 0);
      const disabled =
        (!!min && isBeforeDay(lastDay, min)) ||
        (!!max && isAfterDay(firstDay, max));
      const isCurrent = idx === c.getMonth();
      return { idx, name, disabled, isCurrent };
    });
  });

  // ── Years view data ────────────────────────────────────────────────────────
  yearCells = computed(() => {
    const c = this.cursor();
    const years = decadeRange(c.getFullYear());
    const min = this.min();
    const max = this.max();
    return years.map((y) => {
      const first = new Date(y, 0, 1);
      const last  = new Date(y, 11, 31);
      const disabled =
        (!!min && isBeforeDay(last, min)) ||
        (!!max && isAfterDay(first, max));
      const isCurrent = y === c.getFullYear();
      return { year: y, disabled, isCurrent };
    });
  });

  // ── Lifecycle: keep cursor synced with the bound value when it opens ──────
  constructor() {
    effect(() => {
      // Reset hover/anchor when the panel closes.
      if (!this.isOpen() && !this.inline()) {
        this.rangeAnchor.set(null);
        this.rangeHover.set(null);
      }
    });

    // When the value changes externally, move the cursor to its month so the
    // calendar always shows the selected date the next time it opens.
    // `untracked` on cursor prevents this effect from re-running when prev/next
    // change the cursor — only value changes trigger it.
    effect(() => {
      const v = this.value();
      const target = this.deriveCursorFromValue(v);
      const currentCursor = untracked(() => this.cursor());
      if (target && !isSameMonth(target, currentCursor)) {
        this.cursor.set(target);
      }
    });
  }

  private deriveCursorFromValue(v: Date | DateRange | null): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    if ('start' in v) return v.start ?? v.end ?? null;
    return null;
  }

  // ── Open / close (popover only) ────────────────────────────────────────────
  toggle(): void {
    if (this.isDisabled() || this.inline()) return;
    this.isOpen() ? this.close() : this.open();
  }

  open(): void {
    if (this.isDisabled() || this.isOpen() || this.inline()) return;
    const w = this.triggerEl()?.nativeElement.offsetWidth ?? 0;
    if (w > 0) this.triggerWidth.set(w);
    this.isOpen.set(true);
    this.view.set('days');
    this.opened.emit();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this._onTouched();
    this.closed.emit();
  }

  // ── Header / view navigation ───────────────────────────────────────────────
  prev(): void {
    const c = this.cursor();
    if (this.view() === 'days')   this.cursor.set(addMonths(c, -1));
    else if (this.view() === 'months') this.cursor.set(addYears(c, -1));
    else this.cursor.set(addYears(c, -12));
  }

  next(): void {
    const c = this.cursor();
    if (this.view() === 'days')   this.cursor.set(addMonths(c, 1));
    else if (this.view() === 'months') this.cursor.set(addYears(c, 1));
    else this.cursor.set(addYears(c, 12));
  }

  /** Click the header label to drill out: days → months → years. */
  cycleView(): void {
    if (this.view() === 'days')   this.view.set('months');
    else if (this.view() === 'months') this.view.set('years');
    // years is the top — clicking again does nothing.
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  selectDay(date: Date, disabled: boolean): void {
    if (disabled) return;
    if (this.isRangeMode()) {
      const anchor = this.rangeAnchor();
      const current = this.rangeValue();
      if (!anchor && (!current || (current.start && current.end))) {
        // Start a new range.
        const next: DateRange = { start: date, end: null };
        this.rangeAnchor.set(date);
        this.value.set(next);
        this._onChange(next);
      } else if (anchor) {
        // Commit the range.
        const lo = isBeforeDay(anchor, date) ? anchor : date;
        const hi = isBeforeDay(anchor, date) ? date : anchor;
        const next: DateRange = { start: lo, end: hi };
        this.value.set(next);
        this._onChange(next);
        this.rangeAnchor.set(null);
        this.rangeHover.set(null);
        if (!this.inline()) this.close();
      }
    } else {
      // In time mode, preserve the previously-selected hour/minute (or
      // default to now) so the user keeps tweaking instead of being
      // reset to midnight every time they pick a day.
      if (this.showTime()) {
        const prev = this.singleValue();
        const hours   = prev ? prev.getHours()   : new Date().getHours();
        const minutes = prev ? prev.getMinutes() : new Date().getMinutes();
        date = new Date(date);
        date.setHours(hours, minutes, 0, 0);
      }
      this.value.set(date);
      this._onChange(date);
      // Don't auto-close while the user is also picking a time —
      // they'll close via the Done button or the backdrop.
      if (!this.inline() && !this.showTime()) this.close();
    }
  }

  // ── Time stepper actions (showTime mode only) ──────────────────────────────
  /** Step hour up/minute up/etc., normalising via Date arithmetic. */
  private bumpTime(dHours: number, dMinutes: number): void {
    if (!this.showTime() || this.isRangeMode()) return;
    const base = this.singleValue() ?? new Date(this.cursor());
    const next = new Date(base);
    next.setHours(next.getHours() + dHours);
    next.setMinutes(next.getMinutes() + dMinutes);
    next.setSeconds(0, 0);
    this.value.set(next);
    this._onChange(next);
  }

  hourUp():    void { this.bumpTime(+1, 0); }
  hourDown():  void { this.bumpTime(-1, 0); }
  minuteUp():  void { this.bumpTime(0, +this.timeStep()); }
  minuteDown(): void { this.bumpTime(0, -this.timeStep()); }

  /** Flip AM/PM by adding/subtracting 12 hours from the current value. */
  toggleMeridiem(target: 'AM' | 'PM'): void {
    if (!this.showTime() || this.isRangeMode()) return;
    const cur = this.timePieces();
    if (cur.meridiem === target) return;
    this.bumpTime(target === 'PM' ? +12 : -12, 0);
  }

  selectMonth(idx: number, disabled: boolean): void {
    if (disabled) return;
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), idx, 1));
    this.view.set('days');
  }

  selectYear(year: number, disabled: boolean): void {
    if (disabled) return;
    const c = this.cursor();
    this.cursor.set(new Date(year, c.getMonth(), 1));
    this.view.set('months');
  }

  onDayHover(date: Date): void {
    if (this.isRangeMode() && this.rangeAnchor()) {
      this.rangeHover.set(date);
    }
  }

  // ── Footer actions ─────────────────────────────────────────────────────────
  clear(event?: Event): void {
    event?.stopPropagation();
    const next: Date | DateRange | null =
      this.isRangeMode() ? { start: null, end: null } : null;
    this.value.set(next);
    this._onChange(next);
    this.rangeAnchor.set(null);
    this.rangeHover.set(null);
  }

  goToToday(): void {
    const today = clampDate(new Date(), this.min(), this.max());
    this.cursor.set(today);
    this.view.set('days');
    if (!this.isRangeMode()) {
      const day = startOfDay(today);
      this.value.set(day);
      this._onChange(day);
      if (!this.inline()) this.close();
    }
  }

  /**
   * Apply a quick-pick preset. Range-mode only — in single mode this is a no-op
   * because presets describe a `{ start, end }` range.
   */
  applyPreset(preset: DatePreset): void {
    if (!this.isRangeMode()) return;
    const r = preset.range();
    this.value.set(r);
    this._onChange(r);
    this.rangeAnchor.set(null);
    this.rangeHover.set(null);
    if (r.start) this.cursor.set(r.start);
    if (!this.inline()) this.close();
  }

  // ── ControlValueAccessor ───────────────────────────────────────────────────
  // Lets the component plug into [(ngModel)], [formControl], formControlName.
  // The signal-based [(value)] keeps working alongside this.
  /** @internal */ _onChange: (value: Date | DateRange | null) => void = () => {};
  /** @internal */ _onTouched: () => void = () => {};
  /** @internal */ _cvaDisabled = signal(false);

  writeValue(value: Date | DateRange | null): void {
    this.value.set(value);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: Date | DateRange | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._cvaDisabled.set(isDisabled);
    this.cdr.markForCheck();
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen() && !this.inline()) {
      if (event.key === 'Enter' || event.key === ' ') {
        if (document.activeElement === this.triggerEl()?.nativeElement) {
          event.preventDefault();
          this.open();
        }
      }
      return;
    }

    if (event.key === 'Escape' && !this.inline()) {
      event.preventDefault();
      this.close();
      this.triggerEl()?.nativeElement.focus();
    }
  }
}

// ─── Free helpers ──────────────────────────────────────────────────────────
function pad2(n: number): string { return n < 10 ? '0' + n : String(n); }
