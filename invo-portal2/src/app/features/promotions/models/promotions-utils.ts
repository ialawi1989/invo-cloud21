/** Ported from legacy `pages/promotions/common/common.ts` (only what the ported screens use). */

export function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export function areEqual(data1: any, data2: any): boolean {
  return JSON.stringify(data1) === JSON.stringify(data2);
}

/** Local midnight today. */
export function getToday(): Date {
  const now = new Date(Date.now());
  return new Date(now.setHours(0, 0, 0, 0));
}

/** Keeps the date part of `value` and sets its time to the current time. */
export function withCurrentTime(value: any): Date {
  const now = new Date();
  // "Y-m-d" strings must be parsed as local dates, not UTC
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(+value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10))
      : new Date(value ?? now);
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return date;
}
