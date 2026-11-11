/** Helpers for the "vs. previous period" figure of the statement reports' KPI tiles. */

/** `d` moved by whole months. A date at the end of its month stays at the end (Nov 30 − 1 → Oct 31, not Oct 30). */
export function shiftMonths(d: Date, months: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  const isMonthEnd = d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  r.setDate(isMonthEnd ? last : Math.min(d.getDate(), last));
  return r;
}

/**
 * % change from `before` to `cur`.
 *  - `undefined` → the earlier figure is not known (not loaded);
 *  - `null`      → there was nothing before, so a percentage would mean nothing;
 *  - `0`         → nothing before and nothing now.
 */
export function percentChange(cur: number, before: number | undefined): number | null | undefined {
  if (before === undefined) return undefined;
  if (before === 0) return cur === 0 ? 0 : null;
  return ((cur - before) / Math.abs(before)) * 100;
}
