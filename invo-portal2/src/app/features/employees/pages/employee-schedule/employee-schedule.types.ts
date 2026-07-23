/**
 * Shared types for the employee-schedule board and its sub-forms.
 *
 * The board data mirrors the legacy `employee/getEmployeesSchedule` wire
 * shape: one row per team member, each carrying a `days` array that is
 * index-aligned with the visible week (Saturday → Friday). Every day may
 * hold worked `shift` periods and/or `dayOffShift` time-off entries.
 */

/** A single worked period, `"HH:mm"` 24-hour strings. */
export interface ScheduleShift {
  from: string;
  to:   string;
}

/** A time-off entry sitting on a given day. */
export interface ScheduleDayOff {
  /** e.g. "Annual leave", "Sick leave" — the raw backend label. */
  type:     string;
  /** Persistence id used for edit / delete. */
  offDayId: string;
}

/** One day cell for a team member. */
export interface ScheduleDay {
  date:               string;
  shift:              ScheduleShift[];
  dayOffShift:        ScheduleDayOff[];
  /** Links the day back to its recurring schedule; `null` for an
   *  empty cell that has no schedule yet. */
  employeeScheduleId: string | null;
}

/** A board row — one team member and their week. */
export interface ScheduleEmployee {
  employeeId:   string;
  employeeName: string;
  avatar?:      string;
  days:         ScheduleDay[];
}

/** Off-day payload sent to `saveEmployeeOffDay`. */
export interface EmployeeOffDayPayload {
  id:          string | null;
  employeeId:  string | null;
  branchId:    string;
  type:        string;
  from:        string;
  to:          string | null;
  description: string;
}

/** Canonical week order used across the board and the regular-shift form
 *  (business week starts Saturday). Values match `COMMON.DAYS.*` keys. */
export const WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export type WeekDayName = (typeof WEEK_DAYS)[number];

/** Generate the "00:00" … "23:30" half-hour selection list. */
export function buildTimeOptions(stepMinutes = 30): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h  = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
}

/** Minutes worked across a list of shifts, handling overnight spans. */
export function shiftsHours(shifts: ScheduleShift[] | undefined): number {
  if (!shifts?.length) return 0;
  let total = 0;
  for (const s of shifts) {
    if (!s.from || !s.to) continue;
    const [fh, fm] = s.from.split(':').map(Number);
    const [th, tm] = s.to.split(':').map(Number);
    if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) continue;
    let from = fh * 60 + fm;
    let to   = th * 60 + tm;
    if (to < from) to += 24 * 60; // overnight
    total += to - from;
  }
  return Math.round((total / 60) * 10) / 10;
}

/** True when no two shifts in the list overlap. */
export function noOverlaps(shifts: ScheduleShift[]): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  for (let i = 0; i < shifts.length; i++) {
    const aS = toMin(shifts[i].from);
    const aE = toMin(shifts[i].to);
    for (let j = i + 1; j < shifts.length; j++) {
      const bS = toMin(shifts[j].from);
      const bE = toMin(shifts[j].to);
      if ((bS >= aS && bS < aE) || (bE > aS && bE <= aE) || (bS <= aS && bE >= aE)) {
        return false;
      }
    }
  }
  return true;
}

/** True when every shift has `from` strictly before `to`. */
export function validTimeOrder(shifts: ScheduleShift[]): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return shifts.every((s) => toMin(s.from) < toMin(s.to));
}
