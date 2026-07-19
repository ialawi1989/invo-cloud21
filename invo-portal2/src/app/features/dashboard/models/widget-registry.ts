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

export type WidgetGroup = 'overview' | 'sales' | 'finance' | 'inventory';

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
}

export const WIDGETS: WidgetDef[] = [
  // ── Overview ──────────────────────────────────────────────────────
  { slug: 'business-summary',       title: 'DASHBOARD.W.BUSINESS_SUMMARY',   group: 'overview',  scope: 'period', defaultSpan: 12, minHeight: 260 },
  { slug: 'summary-blocks',         title: 'DASHBOARD.W.SUMMARY_BLOCKS',     group: 'overview',  scope: 'period', defaultSpan: 12, minHeight: 200 },

  // ── Sales ─────────────────────────────────────────────────────────
  { slug: 'sales-by-day',           title: 'DASHBOARD.W.SALES_BY_DAY',       group: 'sales',     scope: 'period', defaultSpan: 8,  minHeight: 340 },
  { slug: 'sales-by-time',          title: 'DASHBOARD.W.SALES_BY_TIME',      group: 'sales',     scope: 'period', defaultSpan: 8,  minHeight: 340 },
  { slug: 'top-items',              title: 'DASHBOARD.W.TOP_ITEMS',          group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 340 },
  { slug: 'top-customers',          title: 'DASHBOARD.W.TOP_CUSTOMERS',      group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 340 },
  { slug: 'sales-by-category',      title: 'DASHBOARD.W.SALES_BY_CATEGORY',  group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 320 },
  { slug: 'sales-by-department',    title: 'DASHBOARD.W.SALES_BY_DEPARTMENT',group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 320 },
  { slug: 'sales-by-brand',         title: 'DASHBOARD.W.SALES_BY_BRAND',     group: 'sales',     scope: 'period', defaultSpan: 4,  minHeight: 320 },
  { slug: 'sales-by-service',       title: 'DASHBOARD.W.SALES_BY_SERVICE',   group: 'sales',     scope: 'period', defaultSpan: 4,  minHeight: 320 },
  { slug: 'sales-by-source',        title: 'DASHBOARD.W.SALES_BY_SOURCE',    group: 'sales',     scope: 'period', defaultSpan: 4,  minHeight: 320 },
  { slug: 'sales-by-employee',      title: 'DASHBOARD.W.SALES_BY_EMPLOYEE',  group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 320 },
  { slug: 'online-invoices',        title: 'DASHBOARD.W.ONLINE_INVOICES',    group: 'sales',     scope: 'period', defaultSpan: 6,  minHeight: 300 },

  // ── Finance ───────────────────────────────────────────────────────
  { slug: 'payments-flow',          title: 'DASHBOARD.W.PAYMENTS_FLOW',      group: 'finance',   scope: 'period', defaultSpan: 8,  minHeight: 380 },
  { slug: 'income-expense',         title: 'DASHBOARD.W.INCOME_EXPENSE',     group: 'finance',   scope: 'period', defaultSpan: 8,  minHeight: 380 },
  { slug: 'payment-methods',        title: 'DASHBOARD.W.PAYMENT_METHODS',    group: 'finance',   scope: 'period', defaultSpan: 6,  minHeight: 320 },

  // ── Inventory ─────────────────────────────────────────────────────
  { slug: 'low-stock',              title: 'DASHBOARD.W.LOW_STOCK',          group: 'inventory', scope: 'global', defaultSpan: 6,  minHeight: 300 },
  { slug: 'expiring-batches',       title: 'DASHBOARD.W.EXPIRING_BATCHES',   group: 'inventory', scope: 'global', defaultSpan: 6,  minHeight: 300 },
];

export const WIDGET_BY_SLUG = new Map(WIDGETS.map((w) => [w.slug, w]));

/** Shown to a user who has never customised — a useful default, not everything. */
export const DEFAULT_LAYOUT: { slug: string; colSpan: number }[] = [
  { slug: 'business-summary', colSpan: 12 },
  { slug: 'sales-by-day',     colSpan: 8 },
  { slug: 'sales-by-source',  colSpan: 4 },
  { slug: 'top-items',        colSpan: 6 },
  { slug: 'top-customers',    colSpan: 6 },
  { slug: 'income-expense',   colSpan: 8 },
  { slug: 'low-stock',        colSpan: 4 },
];
