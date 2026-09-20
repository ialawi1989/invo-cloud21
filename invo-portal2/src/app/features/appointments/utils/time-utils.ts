import { addDays, startOfDay } from '@shared/components/datepicker/date-utils';

/** Business hours + slot granularity for the day/week timeline. Matches the legacy calendar's config. */
export const CALENDAR_START_HOUR = 8;
export const CALENDAR_END_HOUR = 20;
export const SLOT_MINUTES = 15;

/** One "HH:mm" label per slot between `CALENDAR_START_HOUR` and `CALENDAR_END_HOUR`. */
export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
})();

/** Duration options offered when booking a service, in minutes. */
export const DURATION_OPTIONS = [10, 15, 30, 45, 60, 75, 90, 120];

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** "HH:mm" from a Date's local time-of-day. */
export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "h:mm AM/PM" — display label for a slot/appointment card. */
export function formatTimeAmPm(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Combines a calendar day (any time-of-day) with an "HH:mm" slot label into a concrete local Date. */
export function dateAtTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = startOfDay(day);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Human duration label, e.g. 90 → "1h 30m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function isPast(d: Date, now: Date = new Date()): boolean {
  return d.getTime() < now.getTime();
}

/** Monday of the week containing `d` (ISO week start), at local midnight. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const dow = day.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow; // shift back to Monday
  return addDays(day, diff);
}

/** The 7 days (Mon–Sun) of the week containing `d`. */
export function weekDates(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** True if two [start,end) minute ranges overlap. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
