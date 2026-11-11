import { toIso } from '../../utils/report-period.util';

/**
 * Filter state for the Business Overview reports and its conversions.
 *
 * Replaces the legacy global `ReportStateManagerEnhanced` + `FilterConverterService`
 * pair. State lives in the URL (single source of truth), so a page can't read a
 * stale filter left behind by a previous report.
 */

export type CompareType = 'none' | 'period' | 'branch';
export type ComparePeriod = 'Year' | 'Month';

export interface BoFilter {
  /** ISO yyyy-mm-dd. For "as of" reports only `to` is meaningful. */
  from: string;
  to: string;
  branches: string[];
  compareType: CompareType;
  comparePeriod: ComparePeriod;
  /** 1–10, how many previous periods to compare. */
  compareQty: number;
  /** "As of" a single date (`true`) or a from–to range (`false`). Fixed per report unless it is `asOfOptional`. */
  asOf: boolean;
}

export interface BoSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

export const MAX_COMPARE_QTY = 10;

export function defaultFilter(asOf: boolean, now = new Date()): BoFilter {
  const to = toIso(asOf ? now : new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const from = toIso(new Date(now.getFullYear(), now.getMonth(), 1));
  return { from, to, branches: [], compareType: 'none', comparePeriod: 'Year', compareQty: 1, asOf };
}

/** Clamp to what the backend + UI allow. */
export function normalizeFilter(f: BoFilter): BoFilter {
  const qty = Math.min(MAX_COMPARE_QTY, Math.max(1, Math.trunc(Number(f.compareQty)) || 1));
  let type = f.compareType;
  // Branch comparison needs at least two branches to compare.
  if (type === 'branch' && f.branches.length < 2) type = 'none';
  return { ...f, compareType: type, compareQty: qty };
}

/**
 * Backend `filter` payload. Matches the legacy `FilterConverterService`:
 *  - as-of → `date` + `toDate` + `allowAsOf: true`
 *  - comparison → `allowComparison`, `compareType`, `period`/`compareWith`, `periodQty`
 */
export function toApiFilter(f: BoFilter, asOfDefault: boolean): Record<string, any> {
  const n = normalizeFilter(f);
  const asOf = n.asOf ?? asOfDefault;
  // Legacy `FilterConverterService.convertToApiFormat` always starts from `page: 1`, on every report.
  const out: Record<string, any> = { page: 1 };
  if (asOf) {
    out['date'] = n.to;
    out['toDate'] = n.to;
    out['allowAsOf'] = true;
  } else {
    out['fromDate'] = n.from;
    out['toDate'] = n.to;
  }
  if (n.branches.length) out['branches'] = n.branches;

  if (n.compareType !== 'none') {
    out['allowComparison'] = true;
    out['compareType'] = n.compareType === 'period' ? 'Period' : 'Branch';
    if (n.compareType === 'period') {
      out['compareWith'] = n.comparePeriod;
      out['period'] = n.comparePeriod;
      out['periodQty'] = n.compareQty;
    } else {
      out['periodQty'] = 1;
    }
  } else {
    out['allowComparison'] = false;
    out['periodQty'] = 1;
  }
  return out;
}

// ─── URL codec ───────────────────────────────────────────────────────────────

/** `asOfDefault` is what the report does when the user hasn't switched it (a switch is written as `range=1` / `asof=1`). */
export function filterToQuery(f: BoFilter, asOfDefault: boolean): Record<string, string | null> {
  const n = normalizeFilter(f);
  const asOf = n.asOf ?? asOfDefault;
  return {
    // The mode the user switched to, written only when it differs from the report's default.
    range: asOfDefault && !asOf ? '1' : null,
    asof: !asOfDefault && asOf ? '1' : null,
    from: asOf ? null : n.from,
    to: n.to,
    branches: n.branches.length ? n.branches.join(',') : null,
    cmp: n.compareType === 'none' ? null : n.compareType,
    cmpPeriod: n.compareType === 'period' ? n.comparePeriod : null,
    cmpQty: n.compareType === 'period' ? String(n.compareQty) : null,
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function filterFromQuery(q: Record<string, any>, asOfDefault: boolean, now = new Date(), asOfOptional = false): BoFilter {
  // A report that can switch between "as of" and a range carries `range=1` (default as-of → range)
  // or `asof=1` (default range → as-of).
  const asOf = !asOfOptional ? asOfDefault
    : asOfDefault ? q['range'] !== '1'
    : q['asof'] === '1';
  const d = defaultFilter(asOf, now);
  const cmp = q['cmp'] === 'period' || q['cmp'] === 'branch' ? (q['cmp'] as CompareType) : 'none';
  return normalizeFilter({
    from: ISO.test(q['from'] ?? '') ? q['from'] : d.from,
    to: ISO.test(q['to'] ?? '') ? q['to'] : d.to,
    branches: q['branches'] ? String(q['branches']).split(',').filter(Boolean) : [],
    compareType: cmp,
    comparePeriod: q['cmpPeriod'] === 'Month' ? 'Month' : 'Year',
    compareQty: Number(q['cmpQty']) || 1,
    asOf,
  });
}

/**
 * Query for the Profit & Loss report behind the Balance Sheet's "Current Year
 * Net Profit" line: 1 Jan of the sheet's year → the sheet's date, same
 * branches, no comparison (legacy `_getProfitLossQueryParams`).
 */
export function profitLossQueryFor(f: BoFilter): Record<string, string> {
  const q: Record<string, string> = {
    from: `${f.to.slice(0, 4)}-01-01`,
    to: f.to,
  };
  if (f.branches.length) q['branches'] = f.branches.join(',');
  return q;
}

export function sortFromQuery(q: Record<string, any>): BoSort | null {
  const v = q['sortBy'];
  const dir = q['sortDirection'];
  return v && (dir === 'asc' || dir === 'desc') ? { sortValue: String(v), sortDirection: dir } : null;
}
