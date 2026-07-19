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

/** Presets offered by the filter-bar, in display order. */
export const DATE_PRESETS: PresetOption[] = [
  { key: 'today', labelKey: 'REPORTS.PERIOD.TODAY' },
  { key: 'yesterday', labelKey: 'REPORTS.PERIOD.YESTERDAY' },
  { key: 'last7', labelKey: 'REPORTS.PERIOD.LAST_7' },
  { key: 'last30', labelKey: 'REPORTS.PERIOD.LAST_30' },
  { key: 'thisMonth', labelKey: 'REPORTS.PERIOD.THIS_MONTH' },
  { key: 'lastMonth', labelKey: 'REPORTS.PERIOD.LAST_MONTH' },
  { key: 'thisYear', labelKey: 'REPORTS.PERIOD.THIS_YEAR' },
  { key: 'custom', labelKey: 'REPORTS.PERIOD.CUSTOM' },
];

/**
 * Resolve a preset to a concrete `{ from, to }` ISO range. For `custom`, the
 * caller's own `from`/`to` are used (falls back to this month if absent).
 */
export function resolvePreset(
  preset: DatePresetKey,
  custom?: { from?: string; to?: string },
): { from: string; to: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (preset) {
    case 'today': {
      const t = startOfDay(now);
      return { from: toIso(t), to: toIso(t) };
    }
    case 'yesterday': {
      const y = startOfDay(now);
      y.setDate(y.getDate() - 1);
      return { from: toIso(y), to: toIso(y) };
    }
    case 'last7': {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from: toIso(from), to: toIso(now) };
    }
    case 'last30': {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from: toIso(from), to: toIso(now) };
    }
    case 'thisMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toIso(from), to: toIso(to) };
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toIso(from), to: toIso(to) };
    }
    case 'thisYear': {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31);
      return { from: toIso(from), to: toIso(to) };
    }
    case 'custom':
    default: {
      const fallback = resolvePreset('thisMonth');
      return { from: custom?.from || fallback.from, to: custom?.to || fallback.to };
    }
  }
}
