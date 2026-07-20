/**
 * The widget catalogue.
 *
 * One entry per widget the dashboard can place. `slug` is the persistence key —
 * it is written into the saved layout and sent to the server, so slugs are a
 * contract with the legacy `employee/setEmployeeDashboard` payload and must not
 * be renamed casually.
 *
 * Ported from the legacy `initializeDashboardComponents()`, with three
 * deliberate changes:
 *
 * 1. `new-customers` is **included**. Legacy rendered it in the template but
 *    never registered it, so it was unreachable — a bug, not a decision.
 * 2. `last-12-months-sales` is **dropped**. Legacy imported it but never
 *    rendered it; its endpoint is superseded by sales-by-day.
 * 3. Widgets declare `group` and `scope`, which legacy did not. The group drives
 *    the customize picker; `scope: 'global'` marks the ones that ignore the date
 *    filter, so the UI can say so instead of users assuming stale numbers.
 */

/**
 * A way of showing a widget's data. Not every widget can wear every form —
 * a part-of-whole chart of a time series is a lie, so the registry lists only
 * the forms that fit each widget's data and the editor offers just those.
 */
export type WidgetView = 'bar' | 'hbar' | 'area' | 'pie' | 'donut' | 'table';

export type WidgetGroup = 'overview' | 'sales' | 'finance' | 'inventory' | 'custom';

export interface WidgetDef {
  slug: string;
  /** i18n key for the widget title. */
  title: string;
  group: WidgetGroup;
  /** `period` follows the date filter; `global` is always as-of-now. */
  scope: 'period' | 'global';
  /** Default width in 12ths, used when the widget is first added. */
  defaultSpan: number;
  /** Minimum body height so a placed widget doesn't collapse. */
  minHeight: number;
  /**
   * True for widgets backed by a saved custom report rather than a built-in
   * endpoint. These are registered at runtime (the catalogue can't know them
   * at build time) and carry the report id needed to render them.
   */
  custom?: boolean;
  /** Saved-report id, for `custom` widgets only. */
  reportId?: string;
  /**
   * Opens as a table instead of a chart. Right for short ranked lists where the
   * figures and shares are the answer and a chart only hides them behind hover.
   */
  defaultView?: WidgetView;
  /** i18n key for the table's hero caption ("Top category"). */
  heroLabel?: string;
  /**
   * Forms the user may pick from in the customizer. Absent (or a single entry)
   * means the widget has one sensible form and offers no choice — the bespoke
   * widgets are not charts with a swappable body.
   */
  views?: WidgetView[];
}

export const WIDGETS: WidgetDef[] = [
  // ── Overview ──────────────────────────────────────────────────────
  { slug: 'business-summary',       title: 'DASHBOARD.W.BUSINESS_SUMMARY',   group: 'overview',  scope: 'period', defaultSpan: 12, minHeight: 260 },
  { slug: 'summary-blocks',         title: 'DASHBOARD.W.SUMMARY_BLOCKS',     group: 'overview',  scope: 'period', defaultSpan: 12, minHeight: 200 },

  // ── Sales ─────────────────────────────────────────────────────────
  { slug: 'sales-by-day',           title: 'DASHBOARD.W.SALES_BY_DAY',       group: 'sales',     scope: 'period', defaultSpan: 8,  minHeight: 340 },
  { slug: 'sales-by-time',          title: 'DASHBOARD.W.SALES_BY_TIME',      group: 'sales',     scope: 'period', defaultSpan: 8,  minHeight: 340, views: ['bar', 'area', 'table'] },
  { slug: 'top-10-item-by-sales',              title: 'DASHBOARD.W.TOP_ITEMS',          group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 340, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'top-customers',          title: 'DASHBOARD.W.TOP_CUSTOMERS',      group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 340, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'sales-by-category',      title: 'DASHBOARD.W.SALES_BY_CATEGORY',  group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 320, defaultView: 'table', heroLabel: 'DASHBOARD.TOP_CATEGORY', views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'sales-by-departments',    title: 'DASHBOARD.W.SALES_BY_DEPARTMENT',group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 320, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'top-brand-by-sales',         title: 'DASHBOARD.W.SALES_BY_BRAND',     group: 'sales',     scope: 'period', defaultSpan: 4,  minHeight: 320, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'sales-by-service',       title: 'DASHBOARD.W.SALES_BY_SERVICE',   group: 'sales',     scope: 'period', defaultSpan: 4,  minHeight: 320, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'sales-by-source',        title: 'DASHBOARD.W.SALES_BY_SOURCE',    group: 'sales',     scope: 'period', defaultSpan: 4,  minHeight: 320, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'sales-by-employee',      title: 'DASHBOARD.W.SALES_BY_EMPLOYEE',  group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 320, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },
  { slug: 'online-invoices',        title: 'DASHBOARD.W.ONLINE_INVOICES',    group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 300, views: ['bar', 'hbar', 'table'] },

  // ── Finance ───────────────────────────────────────────────────────
  { slug: 'payments-flow',          title: 'DASHBOARD.W.PAYMENTS_FLOW',      group: 'finance',   scope: 'period', defaultSpan: 8,  minHeight: 380 },
  { slug: 'expense-income',         title: 'DASHBOARD.W.INCOME_EXPENSE',     group: 'finance',   scope: 'period', defaultSpan: 8,  minHeight: 380 },
  { slug: 'payment-method-overview',        title: 'DASHBOARD.W.PAYMENT_METHODS',    group: 'finance',   scope: 'period', defaultSpan: 6,  minHeight: 320, views: ['hbar', 'bar', 'pie', 'donut', 'table'] },

  // ── Inventory ─────────────────────────────────────────────────────
  { slug: 'low-quantity-products',              title: 'DASHBOARD.W.LOW_STOCK',          group: 'inventory', scope: 'global', defaultSpan: 6,  minHeight: 300 },
  { slug: 'expiry-date-products',       title: 'DASHBOARD.W.EXPIRING_BATCHES',   group: 'inventory', scope: 'global', defaultSpan: 6,  minHeight: 300 },
];

export const WIDGET_BY_SLUG = new Map(WIDGETS.map((w) => [w.slug, w]));

/**
 * Shown to a user who has never customised — a useful default, not everything.
 * Grouped into rows so the first impression is a deliberate composition rather
 * than whatever the spans happen to flow into.
 */
export const DEFAULT_LAYOUT: { id: string; widgets: { slug: string; colSpan: number }[] }[] = [
  { id: 'row_default_1', widgets: [{ slug: 'business-summary', colSpan: 12 }] },
  { id: 'row_default_2', widgets: [{ slug: 'sales-by-day', colSpan: 8 }, { slug: 'sales-by-source', colSpan: 4 }] },
  { id: 'row_default_3', widgets: [{ slug: 'top-10-item-by-sales', colSpan: 6 }, { slug: 'top-customers', colSpan: 6 }] },
  { id: 'row_default_4', widgets: [{ slug: 'expense-income', colSpan: 8 }, { slug: 'low-quantity-products', colSpan: 4 }] },
];

/**
 * A catalog report placed on the dashboard. These are registered at runtime
 * from the reports catalog (filtered by access), so the build-time catalogue
 * can't list them — the slug namespaces them as `custom-report:<reportSlug>`,
 * which is also the legacy persistence key, so a layout stays portable.
 */
export function customReportWidget(reportSlug: string, title: string): WidgetDef {
  return {
    slug: `custom-report:${reportSlug}`,
    title,
    group: 'custom',
    scope: 'period',
    defaultSpan: 12,
    // No forced cell floor — the card hugs the report's content. The widget's
    // own loading/error state carries its height, so a short report (one total
    // row) doesn't sit in a tall, mostly-empty card.
    minHeight: 0,
    custom: true,
    reportId: reportSlug,
  };
}

/** The report slug behind a `custom-report:<slug>` widget, or null. */
export function customReportId(slug: string): string | null {
  return slug.startsWith('custom-report:') ? slug.slice('custom-report:'.length) : null;
}
