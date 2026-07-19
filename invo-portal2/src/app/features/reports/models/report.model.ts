/**
 * Reports feature — domain models.
 *
 * A modernization of the InvoCloudFront2 "cloud-reports" system. Instead of one
 * hand-written component per report (~90 of them), the whole feature is driven
 * by a metadata **catalog** (`report-catalog.ts`) + a single generic
 * `ReportViewComponent` shell that renders any report described by a `ReportMeta`.
 *
 * The backend contract is unchanged: `POST accounts/reports/{route}` with a
 * `{ filter }` body, responding `{ records, columns, subColumns }`.
 */

/** Business categories reports are grouped under in the catalog. */
export type ReportCategoryKey =
  | 'business-overview'
  | 'sales'
  | 'sales-period'
  | 'inventory'
  | 'customer'
  | 'employee'
  | 'suppliers'
  | 'tax'
  | 'purchase'
  | 'tables'
  | 'expenses'
  | 'others';

/** Which controls the shared filter-bar shows for a given report. */
export interface ReportFilterFlags {
  /** Show the period/date-range picker (default: true). */
  date?: boolean;
  /** Use a single "As of" date instead of a from–to range. */
  asOf?: boolean;
  /** Show the branch multi-select. */
  branches?: boolean;
  /** Restrict the branch selector to a single choice. */
  singleBranch?: boolean;
  /** Show the "compare to previous period" toggle. */
  compare?: boolean;
}

/** Optional chart rendered above the table. Maps normalized rows → series. */
export interface ReportChartConfig {
  type: 'bar' | 'line' | 'area' | 'donut';
  /** Row field used for the category axis / donut labels. */
  labelKey: string;
  /** One entry per plotted series. */
  series: { key: string; nameKey?: string; kind?: 'column' | 'line' }[];
}

/** A KPI stat tile derived from the report result (summed over rows or totals). */
export interface ReportKpiConfig {
  labelKey: string;
  /** Column key to aggregate (summed across rows, or read from `totals`). */
  key: string;
  type?: 'currency' | 'number' | 'percent';
}

/** Export capabilities + backend export path for a report. */
export interface ReportExportConfig {
  pdf?: boolean;
  xlsx?: boolean;
  csv?: boolean;
  /** Backend export path segment (`accounts/reports/export/{path}`). */
  path?: string;
}

/**
 * A single report's metadata. The catalog is an array of these grouped by
 * category. Everything the shell needs to render a report lives here.
 */
export interface ReportMeta {
  /** URL slug (kebab-case) — the `:slug` route param. */
  slug: string;
  /** Backend route name for `accounts/reports/{route}` (camelCase). */
  route: string;
  titleKey: string;
  descriptionKey?: string;
  /** Catalog-card icon key (see `report-icons.ts`). */
  icon?: string;
  /** Privilege gate, e.g. `reportsSecurity.actions.SalesByDepartment.access`. */
  permission?: string;
  filters?: ReportFilterFlags;
  kpis?: ReportKpiConfig[];
  chart?: ReportChartConfig;
  export?: ReportExportConfig;
  canSchedule?: boolean;
  /** Pre-starred in the catalog for first-time users. */
  starredByDefault?: boolean;
  /** ISO date the report was added/updated — drives the "New" tab (< 30 days). */
  updated?: string;
  /**
   * Optional custom normalizer converting the raw API payload into a
   * `ReportResult`. When omitted, `defaultNormalize` is used (flat-list shape).
   */
  normalize?: (raw: RawReportResponse) => ReportResult;
}

/** A category grouping in the catalog. */
export interface ReportGroup {
  key: ReportCategoryKey;
  titleKey: string;
  icon: string;
  reports: ReportMeta[];
}

// ─── Filter state (URL-synced) ───────────────────────────────────────────────

export type DatePresetKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

/** The filter-bar's current selection. Serialized to the URL. */
export interface ReportFilterState {
  preset: DatePresetKey;
  /** ISO yyyy-mm-dd — populated for `custom` (and echoed for presets). */
  from?: string;
  to?: string;
  branches?: string[];
  compare?: boolean;
  sortValue?: string;
  sortDirection?: 'asc' | 'desc';
}

// ─── API shapes ──────────────────────────────────────────────────────────────

/** Raw payload returned by `accounts/reports/{route}`. */
export interface RawReportResponse {
  records?: any[];
  columns?: (string | { key: string; label?: string })[];
  subColumns?: string[];
  totals?: Record<string, any>;
  [k: string]: any;
}

/** The `filter` object POSTed to the backend (subset of the legacy ReportFilter). */
export interface ReportApiFilter {
  fromDate?: string;
  toDate?: string;
  allowAsOf?: boolean;
  branches?: string[];
  compareType?: string;
  period?: string;
  periodQty?: number;
  applyOpeningHour?: boolean;
  sortBy?: { sortValue?: string; sortDirection?: string }[];
  page?: number;
  limit?: number;
  searchTerm?: string;
  [k: string]: any;
}

// ─── Normalized result (what the UI renders) ─────────────────────────────────

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'start' | 'end' | 'center';
  type?: 'text' | 'currency' | 'number' | 'percent' | 'date';
}

export interface ReportTable {
  columns: ReportColumn[];
  rows: Record<string, any>[];
  /** Optional totals row rendered in the table footer. */
  totals?: Record<string, any>;
}

export interface ReportKpi {
  label: string;
  value: number;
  type?: 'currency' | 'number' | 'percent';
  /** Percentage change vs previous period, when comparison is enabled. */
  delta?: number;
}

/** Everything the report-view needs after normalization. */
export interface ReportResult {
  table: ReportTable;
  kpis?: ReportKpi[];
  /** Rows fed to the chart (defaults to `table.rows`). */
  chartRows?: Record<string, any>[];
}
