/**
 * Date-only (calendar day) conversions.
 *
 * Lifted verbatim from `employee-form.component`'s private `toDate()` /
 * `toIso()` so every module that stores a `'yyyy-MM-dd'` string converts it the
 * same way. Both helpers work on the *local* date parts on purpose: going
 * through `Date.toISOString()` shifts the calendar day for anyone east or west
 * of UTC, which is how hire dates end up a day early.
 */

/** Stored ISO `'yyyy-MM-dd'` string → local `Date` (midnight). Parses the
 *  y/m/d parts directly so the calendar day never shifts across timezones.
 *  Returns `null` for empty / unparseable input. */
export function toDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `Date` → ISO `'yyyy-MM-dd'` string using the local date parts. Returns
 *  `null` for a null date. */
export function toIsoDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
