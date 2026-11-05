const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Coerces a journal `createdAt` into a Date — ported from legacy `AdditionalDetailsComponent.toJournalDate`.
 *
 * The value is not one shape across endpoints: epoch milliseconds (number or numeric string), epoch seconds, an ISO
 * string, or an already-parsed Date. Ten-digit epochs are seconds; handing those to `Date` as milliseconds dates every
 * row to 1970, so they are scaled up. Returns null when the value is missing or unparseable (the caller decides).
 */
export function toJournalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const raw = typeof value === 'number' ? value : String(value).trim();
  const numeric = typeof raw === 'number' ? raw : Number(raw);

  // Number('') is 0 and Number('2024-09-26') is NaN — only genuine numbers take the epoch path, the rest is parsed as a date.
  if (raw !== '' && !isNaN(numeric)) {
    const fromEpoch = new Date(Math.abs(numeric) < 1e11 ? numeric * 1000 : numeric);
    return isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a journal `createdAt` (local time) as `yyyy-MM-dd` or `yyyy-MM-dd HH:mm`. Falls back to the raw value rather
 * than throwing on an unexpected shape — a heading with an odd date beats the whole journals panel failing to render —
 * and to '' for null / undefined (never the text "null").
 */
export function formatJournalDate(value: unknown, withTime = false): string {
  const d = toJournalDate(value);
  if (!d) return value === null || value === undefined ? '' : String(value);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}
