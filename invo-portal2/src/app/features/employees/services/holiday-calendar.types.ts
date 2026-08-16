/**
 * Holiday calendars — the contract, and the pure rules over it.
 *
 * ── FRONTEND-FIRST: THESE ENDPOINTS DO NOT EXIST YET ─────────────────────────
 * Nothing in InvoCloudBack serves any of this. The shapes below are the
 * proposal, written here so the portal can be built and reviewed against
 * something concrete rather than the backend and the portal each inventing a
 * half. `HolidayCalendarService` degrades to "unavailable" rather than
 * pretending, so the screen is honest on the day it ships and correct on the
 * day the endpoints land.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── WHAT THIS MUST NOT DO, AND WHY IT IS THE WHOLE DESIGN ────────────────────
 * A stored leave request's `days` is the figure that was **DECIDED**. It is
 * what the balance deducts, and it is deliberately NOT derived live.
 *
 * If `days` were recomputed from a calendar, adding one public holiday would
 * silently restate every historical balance in the system: a request approved
 * for 5 days becomes 4 retroactively, and people who planned around a balance
 * find it has changed underneath them. Nothing here reads, writes or
 * recalculates a stored request. The calendar changes what is SUGGESTED from
 * the day it lands, never what was decided before it.
 *
 * Likewise the leave screen keeps reading `suggestionExcludesPublicHolidays`
 * from `leaveCatalog` rather than inferring it from whether a calendar exists.
 * The server owns that flag because the server owns the suggestion; when the
 * backend starts excluding holidays it flips the flag and the portal's
 * disclaimer disappears on its own, with no portal release. A portal that
 * guessed "there is a calendar, so holidays must be handled" would drop the
 * disclaimer while the count was still wrong.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** One non-working day. */
export interface HolidayDay {
  id: string;
  /** ISO date, `YYYY-MM-DD`. A holiday is a DAY, never an instant. */
  date: string;
  name: string;
  /**
   * A holiday that moves year to year (most religious observances) versus one
   * fixed to a calendar date. Stored so a future "roll forward to next year"
   * knows which dates it may copy and which a human must confirm.
   */
  recurring: boolean;
}

/**
 * A calendar. Per BRANCH, per spec 4.5's `holidayCalendarId` — branches in
 * different countries observe different days, which is the entire reason this
 * is not one company-wide list.
 */
export interface HolidayCalendar {
  id: string;
  name: string;
  /** ISO-3166-1 alpha-2, for the human reading the list. Not used in any rule. */
  country: string | null;
  /** Branches this calendar applies to. Empty means "not yet assigned". */
  branchIds: string[];
  days: HolidayDay[];
}

/** What the service could establish about the backend. */
export interface HolidayCalendarAvailability {
  /** False when the endpoints are absent — the screen says so and offers nothing. */
  available: boolean;
  /** The server's own words, when it gave any. */
  reason: string | null;
}

// ─── Pure rules ───────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` for a date, in LOCAL time — a holiday is a calendar day. */
export function isoDate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Does this calendar mark the date as a holiday?
 *
 * Compares ISO strings rather than Date objects on purpose: two Dates for the
 * same calendar day in different timezones are not equal, and a leave day is a
 * date on a wall calendar, not a moment.
 */
export function isHoliday(calendar: HolidayCalendar | null, date: string): boolean {
  if (!calendar) return false;
  return calendar.days.some(d => d.date === date);
}

/**
 * The holidays falling inside an inclusive range.
 *
 * **Informational only.** This exists so the leave screen can SHOW which
 * holidays sit inside a requested range. It does not, and must not, feed the
 * stored `days` — see the header.
 *
 * Returns them sorted, so the UI does not have to care what order the calendar
 * was entered in.
 */
export function holidaysInRange(
  calendar: HolidayCalendar | null,
  from: string,
  to: string,
): HolidayDay[] {
  if (!calendar || !from || !to) return [];
  // A reversed range is a user mid-edit, not an error worth throwing over.
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return calendar.days
    .filter(d => d.date >= lo && d.date <= hi)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Duplicate dates within one calendar.
 *
 * Two entries for the same day is the error this screen actually produces —
 * someone adds "National Day" twice, or a recurring entry collides with a
 * one-off. It is worth naming before save rather than storing and confusing
 * every count afterwards.
 */
export function duplicateDates(days: HolidayDay[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const d of days) {
    if (!d.date) continue;
    if (seen.has(d.date)) dupes.add(d.date);
    seen.add(d.date);
  }
  return [...dupes].sort();
}
