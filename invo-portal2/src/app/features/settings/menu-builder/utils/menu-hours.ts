/** Display helpers for a menu's hours. Pure, so the list, the badge and the tests share one set of rules. */

const ALL_DAY_END = 23 * 3600 + 59 * 60;

export function toSeconds(time: string | null | undefined, fallback = 0): number {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(time ?? '').trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0) : fallback;
}

/** 00:00 to 23:59 (or the same time twice) covers the whole day. */
export function isAllDay(startAt: string, endAt: string): boolean {
  const s = toSeconds(startAt, 0);
  const e = toSeconds(endAt, ALL_DAY_END);
  return (s === 0 && e >= ALL_DAY_END) || s === e;
}

/** "09:00" (24 h) or "9:00 AM" (12 h, in the locale's own spelling). Seconds are never shown. */
export function formatClock(time: string, use12h: boolean, locale = 'en'): string {
  const secs = toSeconds(time, 0);
  const h = Math.floor(secs / 3600) % 24;
  const m = Math.floor((secs % 3600) / 60);
  if (!use12h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
      .format(new Date(Date.UTC(2026, 0, 1, h, m)));
  } catch {
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
}

export interface HoursView {
  allDay: boolean;
  /** "09:00 – 23:00"; empty when all day (the template shows the "All day" label). */
  range: string;
  /** The window crosses midnight: the template adds "(next day)". */
  overnight: boolean;
  /** "Mon–Fri" / "Mon, Wed"; null when the menu runs every day. */
  days: string | null;
}

export function formatHours(
  m: { startAt: string; endAt: string; days?: number[] | null },
  opts: { use12h?: boolean; locale?: string } = {},
): HoursView {
  const use12h = !!opts.use12h;
  const locale = opts.locale ?? 'en';
  const allDay = isAllDay(m.startAt, m.endAt);
  const overnight = !allDay && toSeconds(m.startAt) > toSeconds(m.endAt, ALL_DAY_END);
  return {
    allDay,
    range: allDay ? '' : `${formatClock(m.startAt, use12h, locale)} – ${formatClock(m.endAt, use12h, locale)}`,
    overnight,
    days: formatDays(m.days, locale),
  };
}

/** Consecutive days collapse to a range ("Mon–Fri"); anything else is listed. null = every day. Week starts on Sunday (0). */
export function formatDays(days: number[] | null | undefined, locale = 'en'): string | null {
  if (!days || days.length === 0 || new Set(days).size >= 7) return null;
  const sorted = [...new Set(days.map(d => ((d % 7) + 7) % 7))].sort((a, b) => a - b);
  const name = (d: number) => {
    try {
      // 2026-01-04 is a Sunday.
      return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + d)));
    } catch { return String(d); }
  };
  const runs: number[][] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && d === last[last.length - 1] + 1) last.push(d); else runs.push([d]);
  }
  return runs.map(r => (r.length >= 3 ? `${name(r[0])}–${name(r[r.length - 1])}` : r.map(name).join(', '))).join(', ');
}
