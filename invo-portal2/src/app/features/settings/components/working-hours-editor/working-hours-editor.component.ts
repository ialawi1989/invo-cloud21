import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';

/** One day of opening hours with zero or more time-slots. */
export interface DayHours {
  day:      string;                      // canonical key — 'Sunday'…'Saturday'
  isClosed: boolean;
  periods:  Array<{ from: string; to: string }>;
}

/** Canonical week order — Sunday first to match the legacy Branch model. */
export const WEEK_DAYS: readonly string[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/**
 * Period-level validator: the `to` field must be strictly later than
 * `from`. Returns `{ toBeforeFrom: true }` on the `to` control so the
 * template can show a focused error.
 */
export const fromBeforeToValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const from = (group.get('from')?.value ?? '').trim();
  const to   = (group.get('to')?.value ?? '').trim();
  if (!from || !to) return null;
  return from < to ? null : { toBeforeFrom: true };
};

/**
 * Day-level validator: any pair of periods overlap → mark the day with
 * `{ overlappingPeriods: true }`. Times are HH:mm strings, so plain
 * lexical comparison works (24-hour clock).
 *
 * Duplicate-period detection is implicit: two ranges with identical
 * `from`/`to` (e.g. both `09:00–10:00`) end up adjacent after the sort
 * and the strict `<` check between them returns true (`'09:00' <
 * '10:00'`), so the day is flagged as conflicting. Back-to-back ranges
 * that touch at the boundary (e.g. `09:00–10:00` and `10:00–12:00`)
 * are intentionally NOT flagged — that's the standard scheduling
 * convention.
 */
export const overlappingPeriodsValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const periods = (group.get('periods') as FormArray | null)?.controls ?? [];
  const ranges = periods
    .map((p) => ({ from: (p.get('from')?.value ?? '') as string, to: (p.get('to')?.value ?? '') as string }))
    .filter((r) => r.from && r.to)
    .sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].from < ranges[i - 1].to) return { overlappingPeriods: true };
  }
  return null;
};

/**
 * working-hours-editor
 * ────────────────────
 * Reusable editor for a 7-day schedule of opening / delivery periods.
 *
 *   • Each day has a toggle (open / closed) and a list of `from–to` slots
 *   • Each slot is `from` + `to` with overlap detection across the day
 *   • A "Copy to all days" action stamps the current day's periods onto
 *     the rest, which is the realistic shortcut for branches that share
 *     the same hours every day.
 *
 * Intentionally headless on storage shape: takes a `dayHours` input and
 * emits the resulting FormArray via `(formArrayChange)`. The parent owns
 * persistence — this component only knows about reactive forms.
 */
@Component({
  selector: 'app-working-hours-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, TimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './working-hours-editor.component.html',
  styleUrl: './working-hours-editor.component.scss',
})
export class WorkingHoursEditorComponent implements OnInit {
  private fb         = inject(FormBuilder);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  /** Initial schedule. Missing days are filled with closed-day defaults. */
  initial = input<DayHours[]>([]);

  /** Where the parent's FormGroup lives — we register our FormArray on it
   *  under `controlName`. Keeps parent dirty/valid/save flow working. */
  parentForm = input.required<FormGroup>();

  /** Key under `parentForm` to expose this schedule as. */
  controlName = input.required<string>();

  /** Re-translate day labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  /** Bumped on every value change so banner-visibility computeds re-run.
   *  FormArrays don't natively expose a signal; we bridge via valueChanges. */
  private formTick = signal(0);

  /** Day indices the user has dismissed the copy-suggestion banner on.
   *  Cleared whenever the schedule for that day changes — the banner
   *  is reasonable to re-suggest after the user edits the times again. */
  private dismissedBanners = signal<ReadonlySet<number>>(new Set());

  /** Snapshot of the per-day schedule key as of the last dismissal —
   *  used to detect "user changed the day after dismissing" so the
   *  banner can resurface intelligently. */
  private lastDismissKey = new Map<number, string>();

  /** Day index whose LAST `to` time was the most recently changed
   *  control. The copy banner only appears on this day — surfacing
   *  the suggestion right after the user finishes typing in the last
   *  field (the natural "I'm done with this row" moment). */
  private lastEditedDay = signal<number | null>(null);

  /** Per-day snapshot of "last period's `to`" so we can detect which
   *  day's final input changed when valueChanges fires. */
  private lastToSnapshot = new Map<number, string>();

  /** The FormArray we own — array of day FormGroups. */
  daysArray!: FormArray<FormGroup>;

  readonly weekDays = WEEK_DAYS;

  // ─── Computed labels ───────────────────────────────────────────────────
  dayLabel = computed<(day: string) => string>(() => {
    this.i18nTick();
    return (day: string) => this.translate.instant('COMMON.DAYS.' + day.toUpperCase()) || day;
  });

  constructor() {
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  ngOnInit(): void {
    // Build the FormArray from the merged initial data — one FormGroup
    // per day, in canonical week order, even if the input is missing days.
    const incoming = new Map<string, DayHours>();
    (this.initial() ?? []).forEach((d) => {
      if (d?.day) incoming.set(d.day, d);
    });
    const dayGroups = WEEK_DAYS.map((d) => this.buildDayGroup(incoming.get(d) ?? {
      day: d,
      isClosed: true,
      periods: [],
    }));
    this.daysArray = this.fb.array(dayGroups);
    this.parentForm().setControl(this.controlName(), this.daysArray);

    // Snapshot initial last-`to` values so the banner stays hidden
    // until the user actually edits something.
    this.refreshLastToSnapshot();

    // Bridge FormArray changes → signal so the "copy to all days" banner
    // re-evaluates whenever any day's periods change.
    this.daysArray.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formTick.update((n) => n + 1);
        this.detectLastInputEdit();
      });
  }

  /** Capture the current "last period's `to`" for each day. */
  private refreshLastToSnapshot(): void {
    for (let i = 0; i < this.daysArray.length; i++) {
      this.lastToSnapshot.set(i, this.lastToOf(i));
    }
  }

  private lastToOf(dayIndex: number): string {
    const periods = this.periodsOf(dayIndex);
    if (periods.length === 0) return '';
    const last = periods.at(periods.length - 1);
    return (last?.get('to')?.value ?? '') as string;
  }

  /**
   * Find which day's last `to` value just changed and mark it as the
   * day to surface the copy banner on. Updates the snapshot for every
   * day so subsequent edits are detected correctly.
   */
  private detectLastInputEdit(): void {
    let edited: number | null = null;
    for (let i = 0; i < this.daysArray.length; i++) {
      const cur = this.lastToOf(i);
      const prev = this.lastToSnapshot.get(i) ?? '';
      if (cur !== prev && edited === null) edited = i;
      this.lastToSnapshot.set(i, cur);
    }
    if (edited !== null) {
      this.lastEditedDay.set(edited);
      // A fresh edit on a previously-dismissed day means the user is
      // iterating again — let the banner resurface.
      this.dismissedBanners.update((set) => {
        if (!set.has(edited!)) return set;
        const next = new Set(set);
        next.delete(edited!);
        return next;
      });
    }
  }

  /**
   * The "Copy these opening hours to all days?" banner shows when this
   * day is open and at least one OTHER open day has a different
   * schedule. Once they all match (either via Yes-copy or manual
   * adjustments), the banner disappears.
   */
  shouldShowCopyBanner(dayIndex: number): boolean {
    this.formTick();                              // tracking
    if (dayIndex < 0 || dayIndex >= this.daysArray.length) return false;

    // Only the most recently edited day's last `to` triggers a banner —
    // the suggestion appears the moment the user finishes typing the
    // final time of that row, never on the others.
    if (this.lastEditedDay() !== dayIndex) return false;

    const me = this.dayAt(dayIndex);
    if (me.controls['isClosed'].value) return false;
    const myKey = this.scheduleKey(dayIndex);
    if (!myKey) return false;

    // Honour explicit dismissal — but only as long as the user hasn't
    // changed this day's schedule since dismissing. Once they edit
    // again, the banner is fair game to resurface.
    if (this.dismissedBanners().has(dayIndex)) {
      const dismissedKey = this.lastDismissKey.get(dayIndex);
      if (dismissedKey === myKey) return false;
    }

    for (let i = 0; i < this.daysArray.length; i++) {
      if (i === dayIndex) continue;
      const other = this.dayAt(i);
      if (other.controls['isClosed'].value) continue; // skip closed days
      if (this.scheduleKey(i) !== myKey) return true;
    }
    return false;
  }

  /** "Not now" — hides the copy banner for this day until the user
   *  edits its periods again (see `shouldShowCopyBanner`). */
  dismissCopyBanner(dayIndex: number): void {
    this.lastDismissKey.set(dayIndex, this.scheduleKey(dayIndex));
    this.dismissedBanners.update((set) => {
      const next = new Set(set);
      next.add(dayIndex);
      return next;
    });
  }

  // ─── Reactive error reads ──────────────────────────────────────────────
  // These mirror direct `dayAt(...).errors` reads but tie them to the
  // formTick signal so the OnPush template re-renders when validity
  // updates after a value change.
  dayHasOverlap(dayIndex: number): boolean {
    this.formTick();
    return !!this.dayAt(dayIndex).errors?.['overlappingPeriods'];
  }

  periodHasToBeforeFrom(dayIndex: number, periodIndex: number): boolean {
    this.formTick();
    return !!this.periodAt(dayIndex, periodIndex).errors?.['toBeforeFrom'];
  }

  /** Stable JSON key of one day's periods used to compare schedules. */
  private scheduleKey(dayIndex: number): string {
    const periods = this.periodsOf(dayIndex).controls
      .map((p) => ({ from: p.get('from')?.value ?? '', to: p.get('to')?.value ?? '' }))
      .filter((p) => p.from && p.to)
      .sort((a, b) => a.from.localeCompare(b.from));
    return JSON.stringify(periods);
  }

  // ─── FormGroup builders ─────────────────────────────────────────────────
  private buildDayGroup(day: DayHours): FormGroup {
    return this.fb.group({
      day:      [day.day],
      isClosed: [!!day.isClosed],
      periods:  this.fb.array(
        (day.periods ?? []).map((p) => this.buildPeriodGroup(p.from, p.to)),
      ),
    }, { validators: overlappingPeriodsValidator });
  }

  private buildPeriodGroup(from = '09:00', to = '17:00'): FormGroup {
    return this.fb.group({
      from: [from, [Validators.required]],
      to:   [to,   [Validators.required]],
    }, { validators: fromBeforeToValidator });
  }

  // ─── Day-level operations ──────────────────────────────────────────────
  dayAt(index: number): FormGroup {
    return this.daysArray.at(index) as FormGroup;
  }

  periodsOf(dayIndex: number): FormArray<FormGroup> {
    return this.dayAt(dayIndex).get('periods') as FormArray<FormGroup>;
  }

  periodAt(dayIndex: number, periodIndex: number): FormGroup {
    return this.periodsOf(dayIndex).at(periodIndex) as FormGroup;
  }

  toggleDay(dayIndex: number): void {
    const ctrl = this.dayAt(dayIndex).get('isClosed') as FormControl;
    const wasClosed = !!ctrl.value;
    ctrl.setValue(!wasClosed);
    const periods = this.periodsOf(dayIndex);
    if (wasClosed) {
      // Re-opening — seed a single default period so the user has
      // something to edit instead of an empty list.
      if (periods.length === 0) periods.push(this.buildPeriodGroup());
    } else {
      // Closing — drop all periods so save doesn't round-trip empty
      // slots that the validator would still try to evaluate.
      while (periods.length > 0) periods.removeAt(0, { emitEvent: false });
      periods.updateValueAndValidity();
    }
  }

  addPeriod(dayIndex: number): void {
    const periods = this.periodsOf(dayIndex);
    const last = periods.at(periods.length - 1)?.value ?? null;
    // Sensible default: start the new slot right after the previous one
    // ends. Falls back to 09–17 when the day was closed.
    const from = last?.to ?? '17:00';
    const to   = from < '23:00' ? this.addHours(from, 2) : '23:59';
    periods.push(this.buildPeriodGroup(from, to));
    // The last-`to` position just shifted — resync the snapshot so the
    // banner's "did the last input change?" detection stays accurate.
    this.refreshLastToSnapshot();
  }

  removePeriod(dayIndex: number, periodIndex: number): void {
    const periods = this.periodsOf(dayIndex);
    periods.removeAt(periodIndex);
    if (periods.length === 0) {
      // Auto-flip the day to closed so the row visibly matches state.
      this.dayAt(dayIndex).patchValue({ isClosed: true });
    }
    this.refreshLastToSnapshot();
  }

  /**
   * Copy the periods of `dayIndex` onto every other day. Most branches
   * have identical hours every day, so this saves users 6 row-by-row
   * copies. Days that are already closed stay closed.
   */
  copyToAll(dayIndex: number): void {
    const sourcePeriods = this.periodsOf(dayIndex).controls.map((c) => ({
      from: c.get('from')!.value ?? '',
      to:   c.get('to')!.value   ?? '',
    }));
    if (sourcePeriods.length === 0) return;
    for (let i = 0; i < this.daysArray.length; i++) {
      if (i === dayIndex) continue;
      const dayGroup = this.dayAt(i);
      dayGroup.patchValue({ isClosed: false });
      const periods = this.periodsOf(i);
      while (periods.length > 0) periods.removeAt(0, { emitEvent: false });
      sourcePeriods.forEach((p) => periods.push(this.buildPeriodGroup(p.from, p.to)));
    }
    // After a successful copy every day matches → banner has no
    // reason to stay up. Clear the trigger so it doesn't immediately
    // re-fire on the next edit elsewhere.
    this.lastEditedDay.set(null);
    this.refreshLastToSnapshot();
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  /** Add `hours` to a `HH:mm` string without touching Date objects. */
  private addHours(time: string, hours: number): string {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const total = (h + hours) * 60 + m;
    const nh = Math.min(23, Math.floor(total / 60));
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }
}
