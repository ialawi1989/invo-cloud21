/**
 * Tiny zero-dependency date helpers used by the DatePicker.
 * All functions return new Date instances — never mutate inputs.
 */

/** Default English month names. Override per instance for i18n. */
export const DEFAULT_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Short month names for compact headers. */
export const DEFAULT_MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Default English day-of-week names (Sunday-first). */
export const DEFAULT_DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Returns a new Date stripped of its time portion (local midnight). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** First day of the month at local midnight. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Last day of the month at local midnight. */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Number of days in a given month (0–11). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Add `n` days; negative goes backwards. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Add `n` months; clamps to last day if target month is shorter. */
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const targetMonth = r.getMonth() + n;
  r.setDate(1);
  r.setMonth(targetMonth);
  const max = daysInMonth(r.getFullYear(), r.getMonth());
  r.setDate(Math.min(d.getDate(), max));
  return r;
}

/** Add `n` years. */
export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12);
}

export function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Strict greater-than comparing only date portions. */
export function isAfterDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

/** Strict less-than comparing only date portions. */
export function isBeforeDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

/** Inclusive day-level "between" check. `start` and `end` may be in any order. */
export function isBetweenDays(d: Date, start: Date, end: Date): boolean {
  const t = startOfDay(d).getTime();
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  return t >= lo && t <= hi;
}

/** Clamps a date to the [min, max] range; either bound may be null. */
export function clampDate(d: Date, min: Date | null, max: Date | null): Date {
  let r = d;
  if (min && isBeforeDay(r, min)) r = min;
  if (max && isAfterDay(r, max)) r = max;
  return r;
}

/**
 * Builds the 6×7 grid of dates shown in the days view, including
 * leading/trailing days from the previous/next month so the grid is full.
 */
export function buildCalendarGrid(
  year: number,
  month: number,
  firstDayOfWeek: number,
): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - firstDayOfWeek + 7) % 7;
  const start = addDays(first, -offset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(start, i));
  }
  return cells;
}

/**
 * Reorders a base 7-day-name array to start at `firstDayOfWeek`.
 * `names` must be Sunday-first.
 */
export function rotateDayNames(names: string[], firstDayOfWeek: number): string[] {
  return [...names.slice(firstDayOfWeek), ...names.slice(0, firstDayOfWeek)];
}

/** Inclusive year range for the years view (e.g. 2020 → [2020..2031]). */
export function decadeRange(year: number): number[] {
  // Anchor on the start of the 12-year block containing `year`.
  const start = year - (year % 12);
  return Array.from({ length: 12 }, (_, i) => start + i);
}

/**
 * Minimal pattern formatter — supports the common tokens we need.
 *
 *   yyyy → 4-digit year       MMMM → full month name
 *   yy   → 2-digit year       MMM  → short month name
 *   MM   → 2-digit month      M    → numeric month
 *   dd   → 2-digit day        d    → numeric day
 */
export function formatDate(
  date: Date,
  pattern: string,
  monthNames: string[] = DEFAULT_MONTH_NAMES,
  monthNamesShort: string[] = DEFAULT_MONTH_NAMES_SHORT,
): string {
  const y  = date.getFullYear();
  const m  = date.getMonth();
  const d  = date.getDate();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

  // Order matters: longer tokens first.
  return pattern
    .replace(/yyyy/g, '' + y)
    .replace(/yy/g,   pad(y % 100))
    .replace(/MMMM/g, monthNames[m])
    .replace(/MMM/g,  monthNamesShort[m])
    .replace(/MM/g,   pad(m + 1))
    .replace(/M/g,    '' + (m + 1))
    .replace(/dd/g,   pad(d))
    .replace(/d/g,    '' + d);
}

/**
 * Parses an ISO-style "yyyy-MM-dd" date string into a local-midnight Date.
 * Returns `null` for invalid input. We deliberately keep this simple — for
 * arbitrary user-typed input, hand the picker a string and let the consumer
 * validate.
 */
export function parseISODate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(+y, +mo - 1, +d);
  // Sanity-check the round-trip — catches things like 2024-02-31.
  if (
    date.getFullYear() !== +y ||
    date.getMonth() !== +mo - 1 ||
    date.getDate() !== +d
  ) {
    return null;
  }
  return date;
}
