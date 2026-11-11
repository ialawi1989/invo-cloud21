import { findReport } from '../../models/report-catalog';
import { toIso } from '../../utils/report-period.util';
import { findBoReport } from '../config/business-overview.config';
import { BoFilter, filterToQuery } from './bo-filter';

/** What the report we navigate TO can do with a filter. */
export interface CarryTarget {
  /** A Business Overview report (own URL codec) rather than a generic metadata report. */
  bo: boolean;
  /** The report's default mode is "as of". */
  asOf: boolean;
  /** The user can switch it between as-of and a range. */
  asOfOptional: boolean;
  /** Offers the "compare to previous period" switch (or, for Business Overview, a comparison). */
  comparison: boolean;
  branches: boolean;
  /** Offers a period comparison (previous N months / years) with columns per period. */
  comparePeriods?: boolean;
  openingHour?: boolean;
  products?: boolean;
  categories?: boolean;
  /** The source choices it offers (empty / absent → no source filter). */
  sourceOptions?: string[];
  voidTimings?: boolean;
}

/** Filters a generic report has beyond the Business Overview ones (what the page keeps in its own state). */
export interface CarryExtras {
  applyOpeningHour?: boolean;
  /** A period comparison of the source report. */
  comparison?: { period: 'Month' | 'Year'; qty: number } | null;
  productIds?: string[];
  categoryIds?: string[];
  sources?: string[];
  voidTimings?: string[];
}

/** The target description of a report, by slug (`null` when there is no such report). */
export function carryTargetFor(slug: string): CarryTarget | null {
  const bo = findBoReport(slug);
  if (bo) return { bo: true, asOf: bo.asOf, asOfOptional: !!bo.asOfOptional, comparison: bo.comparison, branches: true };
  const f = findReport(slug)?.meta.filters;
  if (!findReport(slug)) return null;
  return {
    bo: false, asOf: !!f?.asOf, asOfOptional: !!f?.asOfOptional, comparison: !!f?.compare, branches: !!f?.branches,
    comparePeriods: !!f?.comparePeriods, openingHour: !!f?.applyOpeningHour, products: !!f?.products,
    categories: !!f?.categories, sourceOptions: f?.sources ?? [], voidTimings: !!f?.voidTimings,
  };
}

/**
 * Query params that carry the current report's filters (date range / as-of date, branches, comparison, opening hours,
 * products, categories, source, void timing) over to another report — the legacy behaviour when you move between
 * reports. Whatever the target cannot use is dropped: a comparison on a report without one, branches on a report
 * without a branch filter, and an as-of date turns into the month it falls in when the target only takes a range
 * (and a range into its end date when it only takes a date).
 */
export function carryFilterQuery(f: BoFilter, t: CarryTarget, x: CarryExtras = {}): Record<string, string | null> {
  // A report that opens "as of" by default (Balance Sheet, Trial Balance) always does, whatever the source was; one that
  // opens as a range keeps "as of" only when the source was in that mode. A fixed report is decided by the target.
  const asOf = t.asOfOptional ? (t.asOf || f.asOf) : t.asOf;
  let from = f.from;
  let to = f.to;
  if (!asOf && f.asOf) {
    const d = new Date(f.to + 'T00:00:00');
    from = toIso(new Date(d.getFullYear(), d.getMonth(), 1));
    to = toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  // A period comparison, whichever kind of report it came from.
  const periodCmp = f.compareType === 'period' ? { period: f.comparePeriod, qty: f.compareQty } : (x.comparison ?? null);

  if (t.bo) {
    const cmpType = !t.comparison ? 'none' : periodCmp ? 'period' : f.compareType === 'branch' ? 'branch' : 'none';
    return filterToQuery({
      ...f, asOf, from, to,
      compareType: cmpType,
      comparePeriod: periodCmp?.period ?? f.comparePeriod,
      compareQty: periodCmp?.qty ?? f.compareQty,
      branches: f.branches,
    }, t.asOf);
  }

  // Generic report: preset/fromDate/toDate/branches/compare (+ `range=1` for an as-of report switched to a range).
  const sources = (x.sources ?? []).filter(s => t.sourceOptions?.includes(s));
  return {
    preset: 'custom',
    fromDate: asOf ? to : from,
    toDate: to,
    branches: t.branches && f.branches.length ? f.branches.join(',') : null,
    compare: t.comparison && f.compareType !== 'none' ? 'true' : null,
    range: t.asOf && t.asOfOptional && !asOf ? '1' : null,
    cmp: t.comparePeriods && periodCmp ? periodCmp.period : null,
    cmpQty: t.comparePeriods && periodCmp ? String(periodCmp.qty) : null,
    openingHour: t.openingHour && x.applyOpeningHour ? '1' : null,
    products: t.products && x.productIds?.length ? x.productIds.join(',') : null,
    categories: t.categories && x.categoryIds?.length ? x.categoryIds.join(',') : null,
    sources: sources.length ? sources.join(',') : null,
    voidTimings: t.voidTimings && x.voidTimings?.length ? x.voidTimings.join(',') : null,
  };
}
