import { DatePipe } from '@angular/common';

/** What the employee chose in My Account > Preferences (each undefined = keep the pattern the template asked for). */
export interface DatePatternPrefs {
  /** Angular date pattern for the date part, e.g. 'dd/MM/yyyy'. */
  date?: string;
  /** '12h' | '24h'. */
  time?: '12h' | '24h';
}

/** Date-only patterns the templates use for "a date": these follow the employee's date format. */
const DATE_ONLY = new Set([
  'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy', 'dd MMM yyyy', 'dd/MM/yy', 'd/M/yyyy', 'dd.MM.yyyy',
  'mediumDate', 'shortDate', 'longDate', 'fullDate', 'MMM d, y', 'MMM d, yyyy', 'MMM dd, yyyy', 'd MMM y', 'dd MMM, yyyy', 'MMM dd, y',
]);
/** A bare time (the seconds and the AM/PM marker are carried over). */
const TIME_ONLY = /^(?:HH|hh|H|h):mm(:ss)?(\s*a)?$/;
/** The named patterns that mix a date and a time. */
const NAMED_DATETIME: Record<string, { seconds: boolean }> = { medium: { seconds: true }, short: { seconds: false } };

/**
 * Rewrites the pattern of a `date` pipe so the date and the clock follow the employee's choices. Only well-known date
 * and time patterns are rewritten (a month name, a weekday, "MMM yyyy" ... are left as written), and an unset
 * preference leaves the template's own pattern alone.
 */
export function applyDatePrefs(format: string | undefined, prefs: DatePatternPrefs): string | undefined {
  const timePart = (seconds: boolean): string | null => {
    if (!prefs.time) return null;
    return (prefs.time === '12h' ? 'hh:mm' : 'HH:mm') + (seconds ? ':ss' : '') + (prefs.time === '12h' ? ' a' : '');
  };
  const f = format ?? 'mediumDate';

  if (DATE_ONLY.has(f)) return prefs.date ?? format;

  const named = NAMED_DATETIME[f];
  if (named) {
    const t = timePart(named.seconds);
    return prefs.date || t ? `${prefs.date ?? (f === 'medium' ? 'MMM d, y' : 'M/d/yy')}${t ? ' ' + t : ''}` : format;
  }

  const t = TIME_ONLY.exec(f);
  if (t) return timePart(!!t[1]) ?? format;

  // "<date> <time>" (a space or ", " between them).
  const m = /^(.+?)(?:,\s*|\s+)((?:HH|hh|H|h):mm(?::ss)?(?:\s*a)?)$/.exec(f);
  if (m && DATE_ONLY.has(m[1])) {
    const clock = TIME_ONLY.exec(m[2]);
    const tp = timePart(!!clock?.[1]);
    return `${prefs.date ?? m[1]} ${tp ?? m[2]}`;
  }
  return format;
}

let installed = false;

/**
 * Makes every `date` pipe in the app (and so every template's hard-coded 'dd/MM/yyyy', 'HH:mm', 'medium' ...) follow the
 * employee's preferences without editing each template: the pipe's `transform` is wrapped once, and the preferences are
 * read on every call, so a change applies the next time a pipe runs.
 */
export function installDatePipePreferences(read: () => DatePatternPrefs): void {
  if (installed) return;
  installed = true;
  const original = DatePipe.prototype.transform as (this: DatePipe, ...a: any[]) => string | null;
  (DatePipe.prototype as any).transform = function (this: DatePipe, value: any, format?: string, timezone?: string, locale?: string) {
    return original.call(this, value, applyDatePrefs(format, read()), timezone, locale);
  };
}
