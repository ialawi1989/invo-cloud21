import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import {
  ScheduleEmployee,
  ScheduleShift,
  WeekDayName,
  WEEK_DAYS,
  buildTimeOptions,
  noOverlaps,
  shiftsHours,
  validTimeOrder,
} from '../../employee-schedule.types';

export interface RegularShiftFormData {
  employee: ScheduleEmployee;
  /** Anchor start date (usually the first day of the visible week). */
  date:     string;
  branchId: string;
}

export interface RegularShiftFormResult {
  /** Payload for `saveEmployeeSchedule`. */
  schedule: {
    employeeId:       string;
    employeeName:     string;
    days:             unknown;
    from:             string;
    to:               string | null;
    branchId:         string;
    regularSchedule:  Record<string, ScheduleShift[]>[];
  };
}

/** One day's editable slot within a week. */
interface DaySlot { shifts: ScheduleShift[]; }
type WeekMap = Record<WeekDayName, DaySlot>;

const WEEKDAY_INDEX = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Schedule-type dropdown options (Every Week … Every 4 Weeks). */
interface RepeatOption { value: number; labelKey: string; }
const REPEAT_OPTIONS: RepeatOption[] = [
  { value: 1, labelKey: 'EMPLOYEES.SCHEDULE.WEEK' },
  { value: 2, labelKey: 'EMPLOYEES.SCHEDULE.2WEEKS' },
  { value: 3, labelKey: 'EMPLOYEES.SCHEDULE.3WEEKS' },
  { value: 4, labelKey: 'EMPLOYEES.SCHEDULE.4WEEKS' },
];

interface EndOption { value: 'never' | 'specificDate'; labelKey: string; }
const END_OPTIONS: EndOption[] = [
  { value: 'never',        labelKey: 'EMPLOYEES.SCHEDULE.NEVER' },
  { value: 'specificDate', labelKey: 'EMPLOYEES.SCHEDULE.SPECIFIC_DATE' },
];

/**
 * regular-shift-form (modal)
 * ──────────────────────────
 * Define a team member's recurring weekly pattern — 1-to-4 repeating
 * weeks, each with per-day shift lists, a start date and either a "never"
 * or specific end date. Seeds the first week from the member's current
 * shifts. On save it validates every day and returns the schedule payload
 * for the board to persist via `saveEmployeeSchedule`.
 */
@Component({
  selector: 'app-regular-shift-form',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './regular-shift-form.component.html',
  styleUrl: './regular-shift-form.component.scss',
})
export class RegularShiftFormComponent {
  private data      = inject<RegularShiftFormData>(MODAL_DATA);
  private ref       = inject<ModalRef<RegularShiftFormResult>>(MODAL_REF);
  private toast     = inject(ToastService);
  private translate = inject(TranslateService);

  readonly times         = buildTimeOptions();
  readonly weekDays       = WEEK_DAYS;
  readonly repeatOptions = REPEAT_OPTIONS;
  readonly endOptions    = END_OPTIONS;

  employee = this.data.employee;

  repeatWeek = signal<number>(1);
  startDate  = signal<string>(this.data.date ?? '');
  endOption  = signal<'never' | 'specificDate'>('never');
  endDate    = signal<string | null>(null);

  weeks = signal<WeekMap[]>([this.buildFirstWeek()]);

  repeatDisplay = (o: RepeatOption) => this.translate.instant(o.labelKey);
  repeatCompare = (a: RepeatOption, b: RepeatOption) => a?.value === b?.value;
  selectedRepeat = computed<RepeatOption>(
    () => REPEAT_OPTIONS.find((o) => o.value === this.repeatWeek()) ?? REPEAT_OPTIONS[0],
  );

  endDisplay = (o: EndOption) => this.translate.instant(o.labelKey);
  endCompare = (a: EndOption, b: EndOption) => a?.value === b?.value;
  selectedEnd = computed<EndOption>(
    () => END_OPTIONS.find((o) => o.value === this.endOption()) ?? END_OPTIONS[0],
  );

  onRepeatPick(option: RepeatOption | RepeatOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] : option;
    if (opt) this.changeRepeat(opt.value);
  }

  onEndPick(option: EndOption | EndOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] : option;
    if (opt) this.changeEndOption(opt.value);
  }

  // ─── Seed the first week from the member's current shifts ──────────────
  private buildFirstWeek(): WeekMap {
    const week = this.blankWeek();
    for (const day of this.employee?.days ?? []) {
      const name = this.weekdayName(day.date);
      if (name && day.shift?.length) {
        week[name].shifts = day.shift.map((s) => ({ from: s.from, to: s.to }));
      }
    }
    return week;
  }

  private blankWeek(): WeekMap {
    const week = {} as WeekMap;
    for (const d of WEEK_DAYS) week[d] = { shifts: [] };
    return week;
  }

  private weekdayName(dateStr: string): WeekDayName | null {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return WEEKDAY_INDEX[d.getDay()] as WeekDayName;
  }

  /** Clone → mutate → set, so `@for` sees fresh array references. */
  private mutate(fn: (weeks: WeekMap[]) => void): void {
    const next: WeekMap[] = JSON.parse(JSON.stringify(this.weeks()));
    fn(next);
    this.weeks.set(next);
  }

  // ─── Controls ──────────────────────────────────────────────────────────
  changeRepeat(n: number): void {
    this.repeatWeek.set(n);
    this.mutate((weeks) => {
      while (weeks.length < n) weeks.push(this.blankWeek());
      if (weeks.length > n) weeks.length = n;
    });
  }

  changeEndOption(v: 'never' | 'specificDate'): void {
    this.endOption.set(v);
    if (v === 'never') this.endDate.set(null);
  }

  dayHasShifts(weekIndex: number, day: WeekDayName): boolean {
    return (this.weeks()[weekIndex]?.[day]?.shifts.length ?? 0) > 0;
  }

  toggleDay(weekIndex: number, day: WeekDayName, checked: boolean): void {
    this.mutate((weeks) => {
      if (!checked) {
        weeks[weekIndex][day].shifts = [];
      } else if (!weeks[weekIndex][day].shifts.length) {
        weeks[weekIndex][day].shifts.push({ from: '00:00', to: '00:00' });
      }
    });
  }

  addShift(weekIndex: number, day: WeekDayName): void {
    this.mutate((weeks) => {
      weeks[weekIndex][day].shifts.push({ from: '00:00', to: '00:00' });
    });
  }

  removeShift(weekIndex: number, day: WeekDayName, i: number): void {
    this.mutate((weeks) => {
      weeks[weekIndex][day].shifts.splice(i, 1);
    });
  }

  setFrom(shift: ScheduleShift, value: string | string[] | null): void {
    shift.from = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }
  setTo(shift: ScheduleShift, value: string | string[] | null): void {
    shift.to = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }

  dayHours(weekIndex: number, day: WeekDayName): number {
    return shiftsHours(this.weeks()[weekIndex]?.[day]?.shifts);
  }

  dayLabelKey(day: WeekDayName): string {
    return `COMMON.DAYS.${day.toUpperCase()}`;
  }

  // ─── Save ──────────────────────────────────────────────────────────────
  save(): void {
    const weeks = this.weeks();
    for (let w = 0; w < weeks.length; w++) {
      for (const day of WEEK_DAYS) {
        const shifts = weeks[w][day].shifts;
        if (!shifts.length) continue;
        const ctx = {
          day:  this.translate.instant(this.dayLabelKey(day)),
          week: w + 1,
        };
        if (!noOverlaps(shifts)) {
          this.toast.error(this.translate.instant('EMPLOYEES.SCHEDULE.SHIFT_OVERLAP_CTX', ctx));
          return;
        }
        if (!validTimeOrder(shifts)) {
          this.toast.error(this.translate.instant('EMPLOYEES.SCHEDULE.SHIFT_INVALID_TIME_CTX', ctx));
          return;
        }
      }
    }

    const regularSchedule = weeks.map((week) => {
      const out: Record<string, ScheduleShift[]> = {};
      for (const day of WEEK_DAYS) out[day] = week[day].shifts;
      return out;
    });

    this.ref.close({
      schedule: {
        employeeId:      this.employee.employeeId,
        employeeName:    this.employee.employeeName,
        days:            this.employee.days,
        from:            this.startDate(),
        to:              this.endOption() === 'specificDate' ? this.endDate() : null,
        branchId:        this.data.branchId,
        regularSchedule,
      },
    });
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
