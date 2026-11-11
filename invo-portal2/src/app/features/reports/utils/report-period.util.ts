import { DatePresetKey } from '../models/report.model';

/** ISO yyyy-mm-dd for a Date, in local time (avoids UTC off-by-one). */
export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PresetOption {
  key: DatePresetKey;
  labelKey: string;
}

/**
 * Presets offered by the filter-bar, in the legacy date picker's order. Weeks run Sunday–Saturday (`moment().startOf('week')`);
 * "This …" cover the whole week / month / quarter / year, "Year to date" stops today. `lastMonth` is the legacy "Previous Month";
 * `last7` / `last30` are no longer listed but still resolve (old links).
 */
export const DATE_PRESETS: PresetOption[] = [
  { key: 'today', labelKey: 'REPORTS.PERIOD.TODAY' },
  { key: 'thisWeek', labelKey: 'REPORTS.PERIOD.THIS_WEEK' },
  { key: 'thisMonth', labelKey: 'REPORTS.PERIOD.THIS_MONTH' },
  { key: 'thisQuarter', labelKey: 'REPORTS.PERIOD.THIS_QUARTER' },
  { key: 'thisYear', labelKey: 'REPORTS.PERIOD.THIS_YEAR' },
  { key: 'yearToDate', labelKey: 'REPORTS.PERIOD.YEAR_TO_DATE' },
  { key: 'yesterday', labelKey: 'REPORTS.PERIOD.YESTERDAY' },
  { key: 'previousWeek', labelKey: 'REPORTS.PERIOD.PREVIOUS_WEEK' },
  { key: 'lastMonth', labelKey: 'REPORTS.PERIOD.PREVIOUS_MONTH' },
  { key: 'previousQuarter', labelKey: 'REPORTS.PERIOD.PREVIOUS_QUARTER' },
  { key: 'previousYear', labelKey: 'REPORTS.PERIOD.PREVIOUS_YEAR' },
  { key: 'custom', labelKey: 'REPORTS.PERIOD.CUSTOM' },
];

/**
 * Resolve a preset to a concrete `{ from, to }` ISO range. For `custom`, the
 * caller's own `from`/`to` are used (falls back to this month if absent).
 */
export function resolvePreset(
  preset: DatePresetKey,
  custom?: { from?: string; to?: string },
  /** "Today" — only tests pass it. */
  now: Date = new Date(),
): { from: string; to: string } {
  const day = (y: number, m: number, d: number) => new Date(y, m, d);
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const range = (from: Date, to: Date) => ({ from: toIso(from), to: toIso(to) });
  const weekStart = (back = 0) => day(y, m, d - now.getDay() - 7 * back);
  const quarterStart = (back = 0) => day(y, Math.floor(m / 3) * 3 - 3 * back, 1);

  switch (preset) {
    case 'today': return range(day(y, m, d), day(y, m, d));
    case 'yesterday': return range(day(y, m, d - 1), day(y, m, d - 1));
    case 'last7': return range(day(y, m, d - 6), day(y, m, d));
    case 'last30': return range(day(y, m, d - 29), day(y, m, d));
    case 'thisWeek': { const s = weekStart(); return range(s, day(s.getFullYear(), s.getMonth(), s.getDate() + 6)); }
    case 'previousWeek': { const s = weekStart(1); return range(s, day(s.getFullYear(), s.getMonth(), s.getDate() + 6)); }
    case 'thisMonth': return range(day(y, m, 1), day(y, m + 1, 0));
    case 'lastMonth': return range(day(y, m - 1, 1), day(y, m, 0));
    case 'thisQuarter': { const s = quarterStart(); return range(s, day(s.getFullYear(), s.getMonth() + 3, 0)); }
    case 'previousQuarter': { const s = quarterStart(1); return range(s, day(s.getFullYear(), s.getMonth() + 3, 0)); }
    case 'thisYear': return range(day(y, 0, 1), day(y, 11, 31));
    case 'yearToDate': return range(day(y, 0, 1), day(y, m, d));
    case 'previousYear': return range(day(y - 1, 0, 1), day(y - 1, 11, 31));
    case 'custom':
    default: {
      const fallback = resolvePreset('thisMonth', undefined, now);
      return { from: custom?.from || fallback.from, to: custom?.to || fallback.to };
    }
  }
}
