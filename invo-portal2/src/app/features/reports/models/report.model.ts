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
import type { EmployeeEarningsFeature } from '@core/auth/employee-earnings';

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
  | 'attendance'
  | 'discount'
  | 'expenses'
  | 'others';

/** Which controls the shared filter-bar shows for a given report. */
export interface ReportFilterFlags {
  /** Show the period/date-range picker (default: true). */
  date?: boolean;
  /** One month, picked from a month grid (Attendance Trends): the period is that month's first to last day. */
  monthOnly?: boolean;
  /** Use a single "As of" date instead of a from–to range. */
  asOf?: boolean;
  /** With `asOf`: let the user switch to a from–to range (the "As of" checkbox in the date panel). */
  asOfOptional?: boolean;
  /** Show the branch multi-select. */
  branches?: boolean;
  /** Restrict the branch selector to a single choice. */
  singleBranch?: boolean;
  /** Show the "compare to previous period" toggle. */
  compare?: boolean;
  /** Offer a period comparison (previous N months / years) in the Filters dialog — the report shows one column per period. */
  comparePeriods?: boolean;
  /** The report lets the user pick its sub-columns ("Customize columns", see `columns/report-columns.ts`) — kept in the URL as `cols`. */
  subColumns?: boolean;
  /** Product filter (multi-select, searched on the server) in the Filters dialog. */
  products?: boolean;
  /** "Filter by" (group by) single choice, e.g. brand / category / department — the first one is the default. */
  filterBy?: string[];
  /** "Voided by" employee filter (Voided Sales). */
  voidedBy?: boolean;
  /** Void-reason filter, from the company's void reasons (Voided Sales). */
  voidReasons?: boolean;
  /** Name of the API field the "filter by" choice is sent as (default `filterBy`); with it, the first value means "none" and is not sent. */
  filterByKey?: string;
  /** i18n key of the "filter by" section title (default "Filter by"). */
  filterByLabel?: string;
  /** Purchase mode choice — actual (bill) / planned (PO) / forecast (bill & PO). */
  purchaseMode?: boolean;
  /** Only one product can be chosen (Product Movement). */
  singleProduct?: boolean;
  /** A product must be chosen before the report runs. */
  requireProduct?: boolean;
  /** Product-type choices (multi-select), sent as `types` (Reorder Alert). */
  productTypes?: string[];
  /** API field the selected locations are sent as (default `locationIds`; Reorder Alert reads `locations`). */
  locationsKey?: string;
  /** Customer type choice (Individual / Business), sent as `type`. */
  customerType?: boolean;
  /** "Attribute sales to the sales employee" switch, sent as `isSalesEmployee`. */
  salesEmployee?: boolean;
  /** One employee (Attendance), sent as `employeeId`. */
  singleEmployee?: boolean;
  /** API field the chosen employee is sent as (default `employeeId`; the audit sends `adjustedBy`). */
  singleEmployeeKey?: string;
  /** The employee must be chosen before the report runs (Employee Attendance Detail). */
  requireEmployee?: boolean;
  /** i18n key of that picker's heading (default `REPORTS.FILTER.EMPLOYEE`). */
  singleEmployeeLabel?: string;
  /** One discount (Sales by Discount), sent as `discountId`; `others` = documents with no discount. */
  discount?: boolean;
  /** The discount must be chosen before the report runs. */
  requireDiscount?: boolean;
  /** Supplier filter (multi-select), sent as `supplierIds`. */
  suppliers?: boolean;
  /** Customer filter (multi-select), sent as `customerIds`. */
  customers?: boolean;
  /** "Only customers with a balance" checkbox. */
  hasBalanceOnly?: boolean;
  /** Inventory-location filter (multi-select, General Inventory). */
  locations?: boolean;
  /** "Hide deleted products" checkbox. */
  hideDeleted?: boolean;
  /** Void-timing filter (same day / different day / month / year) — Voided Sales. */
  voidTimings?: boolean;
  /** Category filter (multi-select, searched on the server) in the Filters dialog. */
  categories?: boolean;
  /** Source filter (multi-select) with these choices in the Filters dialog, e.g. `['POS', 'Online']`. */
  sources?: string[];
  /** API field the choice list is sent as (default `sources`; VAT Audit sends `types`). */
  sourcesKey?: string;
  /** i18n key of the choice list's heading (default `REPORTS.FILTER.SOURCE`). */
  sourcesLabel?: string;
  /** i18n key prefix that turns a choice into its label (`REPORTS.TIP_KINDS.` + `direct`); default: the choice itself. */
  sourcesOptionPrefix?: string;
  /** Show the "apply opening hours" toggle (the business day, not the calendar day, bounds the dates). */
  applyOpeningHour?: boolean;
  /**
   * Block the report's API call until exactly one branch is selected (e.g. a
   * "Daily Closing"-style report that needs a concrete `branchId`). Mirrors
   * InvoCloudFront2's required-entity-filter gate — narrowed here to branch
   * selection since that is the only entity-style picker the generic report
   * shell currently exposes; other pickers (product/employee/customer/
   * supplier/discount) don't have an equivalent filter-bar control yet.
   */
  requireBranch?: boolean;
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
  /** Hidden (catalog + direct URL) until the company switches this commission / tips feature on. */
  earningsFeature?: EmployeeEarningsFeature;
  /** Extra keys merged into the `filter` POSTed to the backend (e.g. a page size for reports the shell doesn't page). */
  requestFilter?: Record<string, any>;
  kpis?: ReportKpiConfig[];
  chart?: ReportChartConfig;
  export?: ReportExportConfig;
  /** A notice shown under the filters (the legacy report `note`): an i18n key and its look. */
  note?: { key: string; type: 'warning' | 'info' };
  canSchedule?: boolean;
  /**
   * Render this component as the report body instead of the generic table (the page frame, filters, export and
   * favourites stay the shared ones). Used where the legacy report is not a flat table.
   */
  customBody?: 'sales-summary' | 'comparison' | 'sales-by-product' | 'item-transactions' | 'voided-sales' | 'products-category' | 'products-vs-options' | 'sales-by-terminal' | 'sales-by-delivery-area' | 'sales-by-product-vs-service' | 'sales-by-hours-by-product' | 'department-sales-payments' | 'daily-closing' | 'daily-sales-sub' | 'aggregator-sub' | 'service-details' | 'sales-by-invoice' | 'general-inventory' | 'product-movement' | 'flat' | 'customer-aging' | 'customer-aging-summary' | 'supplier-aging' | 'supplier-aging-summary' | 'cashier-shifts' | 'attendance-trends' | 'attendance-detail' | 'attendance-audit' | 'attendance-absence' | 'vat-report';
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
  | 'thisWeek'
  | 'thisQuarter'
  | 'yearToDate'
  | 'previousWeek'
  | 'previousQuarter'
  | 'previousYear'
  | 'custom';

/** The filter-bar's current selection. Serialized to the URL. */
export interface ReportFilterState {
  preset: DatePresetKey;
  /** ISO yyyy-mm-dd — populated for `custom` (and echoed for presets). */
  from?: string;
  to?: string;
  branches?: string[];
  compare?: boolean;
  applyOpeningHour?: boolean;
  /** Selected products (ids) of a `products` report. */
  productIds?: string[];
  /** Selected categories (ids) of a `categories` report. */
  categoryIds?: string[];
  /** Selected "voided by" employee ids. */
  employeeIds?: string[];
  /** Selected void reasons. */
  voidReasons?: string[];
  /** Selected purchase mode (`actual` | `planned` | `forecast`). */
  mode?: string;
  /** Selected product types. */
  productTypes?: string[];
  /** Selected customer type (`''` = any). */
  customerType?: string;
  /** Selected customers. */
  customerIds?: string[];
  /** Sales are attributed to the sales employee (not the line's employee). */
  salesEmployee?: boolean;
  /** The chosen discount (one id, or `others`). */
  discountIds?: string[];
  /** Selected suppliers. */
  supplierIds?: string[];
  /** Only customers with a balance. */
  hasBalanceOnly?: boolean;
  /** Selected inventory locations. */
  locationIds?: string[];
  /** Hide deleted products. */
  hideDeleted?: boolean;
  /** Selected "filter by" value of a `filterBy` report. */
  filterBy?: string;
  /** Selected void timings of a `voidTimings` report. */
  voidTimings?: string[];
  /** Selected sources of a `sources` report. */
  sources?: string[];
  /** Period comparison (`comparePeriods` reports): compare with the previous `qty` months / years. */
  comparison?: { period: 'Month' | 'Year'; qty: number } | null;
  /** Sub-columns chosen for a `subColumns` report (its defaults when absent). */
  subColumns?: string[];
  /** Date mode of an as-of report: `false` = the user switched it to a range (absent/true = as of a date). */
  asOf?: boolean;
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

/** The period a row's link carries over to the report it opens. */
export interface ReportLinkContext { fromDate?: string; toDate?: string; branches?: string[]; }
/** Where a cell links to: a route and its query params. */
export interface ReportCellLink { path: any[]; query?: Record<string, string | null>; }

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'start' | 'end' | 'center';
  type?: 'text' | 'currency' | 'number' | 'percent' | 'date';
  /** Makes the cell a link; return `null` for rows with nothing to open. */
  link?: (row: Record<string, any>, ctx: ReportLinkContext) => ReportCellLink | null;
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
  /** Small text after the value ("/ 30"). */
  suffix?: string;
  type?: 'currency' | 'number' | 'percent';
  /** Accent colour of the tile's top border; defaults to the brand teal. */
  tone?: 'income' | 'expense' | 'profit' | 'asset' | 'liability' | 'equity';
  /** Percentage change vs previous period, when comparison is enabled. */
  /** % change vs the previous period; `null` = there is no previous figure to compare with. */
  delta?: number | null;
}

/** Everything the report-view needs after normalization. */
export interface ReportResult {
  table: ReportTable;
  kpis?: ReportKpi[];
  /** Rows fed to the chart (defaults to `table.rows`). */
  chartRows?: Record<string, any>[];
}
