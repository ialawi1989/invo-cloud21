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
  /**
   * What HR decided, or `Approved` for a company that has no HR module and
   * whose supervisor is therefore the authority.
   *
   * The board shows it because otherwise the two screens describe the same day
   * differently: HR says awaiting approval and the rota says the person is
   * off, with nothing on either screen reconciling them. Rejected entries do
   * not arrive here at all - they are not absences.
   */
  status?: 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | string;
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

/** `"HH:mm"` (24h) → a Fresha-style 12-hour label: `"10 AM"`, `"7 PM"`,
 *  `"10:30 AM"`. Whole hours drop the `":00"`. Returns the input unchanged
 *  when it can't be parsed. */
export function formatTime12(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** A whole shift range as a 12-hour label: `"10 AM - 7 PM"`. */
export function formatShiftRange(shift: ScheduleShift): string {
  return `${formatTime12(shift.from)} - ${formatTime12(shift.to)}`;
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
