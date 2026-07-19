import { ReportGroup, ReportMeta } from './report.model';

/**
 * The master reports catalog — the modern equivalent of InvoCloudFront2's
 * `reports.ts`. Each entry is pure metadata; the generic `ReportViewComponent`
 * renders any of them. Add a report by adding an object here (and a privilege
 * in `reportsSecurity.ts` + i18n keys) — no new component required.
 *
 * `route` is the backend endpoint name (`accounts/reports/{route}`).
 * `permission` maps to `reportsSecurity.actions.{action}.access`.
 *
 * NOTE: A representative subset is fully wired (KPIs + chart). The rest carry
 * metadata only and render through the same shell as soon as the backend
 * endpoint responds — this is the whole point of the metadata-driven design.
 */

const RECENT = '2026-07-01'; // used to surface a few reports under the "New" tab

export const REPORT_CATALOG: ReportGroup[] = [
  // ── Business Overview ──────────────────────────────────────────────────────
  {
    key: 'business-overview',
    titleKey: 'REPORTS.GROUPS.BUSINESS_OVERVIEW',
    icon: 'book',
    reports: [
      {
        slug: 'profit-and-loss', route: 'profitAndLoss',
        titleKey: 'REPORTS.ITEMS.PROFIT_AND_LOSS', descriptionKey: 'REPORTS.DESC.PROFIT_AND_LOSS',
        icon: 'trending-up', permission: 'reportsSecurity.actions.ProfitandLoss.access',
        filters: { date: true, branches: true, compare: true }, canSchedule: true,
        export: { pdf: true, xlsx: true }, starredByDefault: true,
      },
      {
        slug: 'balance-sheet', route: 'balanceSheet',
        titleKey: 'REPORTS.ITEMS.BALANCE_SHEET', descriptionKey: 'REPORTS.DESC.BALANCE_SHEET',
        icon: 'book', permission: 'reportsSecurity.actions.BalanceSheet.access',
        filters: { asOf: true, branches: true }, canSchedule: true, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'trial-balance', route: 'trialBalance',
        titleKey: 'REPORTS.ITEMS.TRIAL_BALANCE', descriptionKey: 'REPORTS.DESC.TRIAL_BALANCE',
        icon: 'file-text', permission: 'reportsSecurity.actions.TrialBalanceBasisAccrual.access',
        filters: { asOf: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'general-ledger', route: 'generalLedger',
        titleKey: 'REPORTS.ITEMS.GENERAL_LEDGER', descriptionKey: 'REPORTS.DESC.GENERAL_LEDGER',
        icon: 'book', permission: 'reportsSecurity.actions.GeneralLedgerReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'journal-entries', route: 'journalEntries',
        titleKey: 'REPORTS.ITEMS.JOURNAL_ENTRIES', descriptionKey: 'REPORTS.DESC.JOURNAL_ENTRIES',
        icon: 'file-text', permission: 'reportsSecurity.actions.JournalEntries.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Sales ──────────────────────────────────────────────────────────────────
  {
    key: 'sales',
    titleKey: 'REPORTS.GROUPS.SALES',
    icon: 'trending-up',
    reports: [
      {
        slug: 'sales-summary', route: 'salesSummary',
        titleKey: 'REPORTS.ITEMS.SALES_SUMMARY', descriptionKey: 'REPORTS.DESC.SALES_SUMMARY',
        icon: 'trending-up', permission: 'reportsSecurity.actions.SalesSummary.access',
        filters: { date: true, branches: true, compare: true }, canSchedule: true,
        export: { pdf: true, xlsx: true, csv: true }, starredByDefault: true, updated: RECENT,
        kpis: [
          { labelKey: 'REPORTS.KPI.GROSS_SALES', key: 'grossSales', type: 'currency' },
          { labelKey: 'REPORTS.KPI.NET_SALES', key: 'netSales', type: 'currency' },
          { labelKey: 'REPORTS.KPI.ORDERS', key: 'orders', type: 'number' },
          { labelKey: 'REPORTS.KPI.AVG_ORDER', key: 'avgOrder', type: 'currency' },
        ],
        chart: {
          type: 'area', labelKey: 'label',
          series: [{ key: 'netSales', nameKey: 'REPORTS.KPI.NET_SALES' }],
        },
      },
      {
        slug: 'sales-by-department', route: 'salesByDepartments',
        titleKey: 'REPORTS.ITEMS.SALES_BY_DEPARTMENT', descriptionKey: 'REPORTS.DESC.SALES_BY_DEPARTMENT',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByDepartment.access',
        filters: { date: true, branches: true, compare: true }, canSchedule: true,
        export: { pdf: true, xlsx: true, csv: true }, updated: RECENT,
        kpis: [
          { labelKey: 'REPORTS.KPI.NET_SALES', key: 'netSales', type: 'currency' },
          { labelKey: 'REPORTS.KPI.QTY_SOLD', key: 'qty', type: 'number' },
        ],
        chart: {
          type: 'bar', labelKey: 'label',
          series: [{ key: 'netSales', nameKey: 'REPORTS.KPI.NET_SALES', kind: 'column' }],
        },
      },
      {
        slug: 'sales-by-category', route: 'salesByCategory',
        titleKey: 'REPORTS.ITEMS.SALES_BY_CATEGORY', descriptionKey: 'REPORTS.DESC.SALES_BY_CATEGORY',
        icon: 'pie-chart', permission: 'reportsSecurity.actions.SalesByCategory.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, csv: true },
        kpis: [{ labelKey: 'REPORTS.KPI.NET_SALES', key: 'netSales', type: 'currency' }],
        chart: {
          type: 'donut', labelKey: 'label',
          series: [{ key: 'netSales', nameKey: 'REPORTS.KPI.NET_SALES' }],
        },
      },
      {
        slug: 'sales-by-product', route: 'salesByItem',
        titleKey: 'REPORTS.ITEMS.SALES_BY_PRODUCT', descriptionKey: 'REPORTS.DESC.SALES_BY_PRODUCT',
        icon: 'box', permission: 'reportsSecurity.actions.SalesByItem.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, csv: true },
      },
      {
        slug: 'sales-by-employee', route: 'salesByEmployee',
        titleKey: 'REPORTS.ITEMS.SALES_BY_EMPLOYEE', descriptionKey: 'REPORTS.DESC.SALES_BY_EMPLOYEE',
        icon: 'user-check', permission: 'reportsSecurity.actions.SalesByEmployee.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'sales-by-terminal', route: 'salesByTerminal',
        titleKey: 'REPORTS.ITEMS.SALES_BY_TERMINAL', descriptionKey: 'REPORTS.DESC.SALES_BY_TERMINAL',
        icon: 'grid', permission: 'reportsSecurity.actions.SalesByTerminal.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'sales-by-invoice', route: 'salesByInvoice',
        titleKey: 'REPORTS.ITEMS.SALES_BY_INVOICE', descriptionKey: 'REPORTS.DESC.SALES_BY_INVOICE',
        icon: 'file-text', permission: 'reportsSecurity.actions.SalesByInvoice.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, csv: true },
      },
    ],
  },

  // ── Sales by Period ──────────────────────────────────────────────────────
  {
    key: 'sales-period',
    titleKey: 'REPORTS.GROUPS.SALES_PERIOD',
    icon: 'calendar',
    reports: [
      {
        slug: 'daily-sales', route: 'dailySales', titleKey: 'REPORTS.ITEMS.DAILY_SALES',
        descriptionKey: 'REPORTS.DESC.DAILY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.DailySales.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
        chart: { type: 'line', labelKey: 'label', series: [{ key: 'netSales', nameKey: 'REPORTS.KPI.NET_SALES' }] },
      },
      {
        slug: 'hourly-sales', route: 'hourlySales', titleKey: 'REPORTS.ITEMS.HOURLY_SALES',
        descriptionKey: 'REPORTS.DESC.HOURLY_SALES', icon: 'clock',
        permission: 'reportsSecurity.actions.HourlySales.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
        chart: { type: 'bar', labelKey: 'label', series: [{ key: 'netSales', nameKey: 'REPORTS.KPI.NET_SALES', kind: 'column' }] },
      },
      {
        slug: 'weekday-sales', route: 'weekdaySales', titleKey: 'REPORTS.ITEMS.WEEKDAY_SALES',
        descriptionKey: 'REPORTS.DESC.WEEKDAY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.WeekdaySales.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'monthly-sales', route: 'monthlySales', titleKey: 'REPORTS.ITEMS.MONTHLY_SALES',
        descriptionKey: 'REPORTS.DESC.MONTHLY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.MonthlySales.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
        chart: { type: 'area', labelKey: 'label', series: [{ key: 'netSales', nameKey: 'REPORTS.KPI.NET_SALES' }] },
      },
      {
        slug: 'yearly-sales', route: 'yearlySales', titleKey: 'REPORTS.ITEMS.YEARLY_SALES',
        descriptionKey: 'REPORTS.DESC.YEARLY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.YearlySales.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Inventory ──────────────────────────────────────────────────────────────
  {
    key: 'inventory',
    titleKey: 'REPORTS.GROUPS.INVENTORY',
    icon: 'box',
    reports: [
      {
        slug: 'general-inventory', route: 'generalInventory', titleKey: 'REPORTS.ITEMS.GENERAL_INVENTORY',
        descriptionKey: 'REPORTS.DESC.GENERAL_INVENTORY', icon: 'box',
        permission: 'reportsSecurity.actions.GeneralInventoryReport.access',
        filters: { asOf: true, branches: true }, export: { pdf: true, xlsx: true, csv: true },
      },
      {
        slug: 'reorder-report', route: 'reorderReport', titleKey: 'REPORTS.ITEMS.REORDER_REPORT',
        descriptionKey: 'REPORTS.DESC.REORDER_REPORT', icon: 'shopping-cart',
        permission: 'reportsSecurity.actions.ReorderReport.access',
        filters: { branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'product-movement', route: 'productMovement', titleKey: 'REPORTS.ITEMS.PRODUCT_MOVEMENT',
        descriptionKey: 'REPORTS.DESC.PRODUCT_MOVEMENT', icon: 'layers',
        permission: 'reportsSecurity.actions.ProductMovment.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'expired-products', route: 'expiredProducts', titleKey: 'REPORTS.ITEMS.EXPIRED_PRODUCTS',
        descriptionKey: 'REPORTS.DESC.EXPIRED_PRODUCTS', icon: 'box',
        permission: 'reportsSecurity.actions.ExpiredProductsReport.access',
        filters: { asOf: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'wastage-summary', route: 'wastageSummary', titleKey: 'REPORTS.ITEMS.WASTAGE_SUMMARY',
        descriptionKey: 'REPORTS.DESC.WASTAGE_SUMMARY', icon: 'layers',
        permission: 'reportsSecurity.actions.WastageSummaryReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Customer ─────────────────────────────────────────────────────────────
  {
    key: 'customer',
    titleKey: 'REPORTS.GROUPS.CUSTOMER',
    icon: 'users',
    reports: [
      {
        slug: 'customer-order-history', route: 'customerOrderHistory',
        titleKey: 'REPORTS.ITEMS.CUSTOMER_ORDER_HISTORY', descriptionKey: 'REPORTS.DESC.CUSTOMER_ORDER_HISTORY',
        icon: 'users', permission: 'reportsSecurity.actions.CustomerOrderHistory.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, csv: true },
      },
      {
        slug: 'customer-balance-summary', route: 'customerBalanceSummary',
        titleKey: 'REPORTS.ITEMS.CUSTOMER_BALANCE_SUMMARY', descriptionKey: 'REPORTS.DESC.CUSTOMER_BALANCE_SUMMARY',
        icon: 'credit-card', permission: 'reportsSecurity.actions.CustomerBalanceSummary.access',
        filters: { asOf: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'customer-aging', route: 'customerAging', titleKey: 'REPORTS.ITEMS.CUSTOMER_AGING',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_AGING', icon: 'clock',
        permission: 'reportsSecurity.actions.CustomerAgingReport.access',
        filters: { asOf: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'payment-received', route: 'paymentReceived', titleKey: 'REPORTS.ITEMS.PAYMENT_RECEIVED',
        descriptionKey: 'REPORTS.DESC.PAYMENT_RECEIVED', icon: 'credit-card',
        permission: 'reportsSecurity.actions.PaymentReceivedReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Employee ─────────────────────────────────────────────────────────────
  {
    key: 'employee',
    titleKey: 'REPORTS.GROUPS.EMPLOYEE',
    icon: 'user-check',
    reports: [
      {
        slug: 'cashier-report', route: 'cashierReport', titleKey: 'REPORTS.ITEMS.CASHIER_REPORT',
        descriptionKey: 'REPORTS.DESC.CASHIER_REPORT', icon: 'user-check',
        permission: 'reportsSecurity.actions.CashierReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'driver-report', route: 'driverReport', titleKey: 'REPORTS.ITEMS.DRIVER_REPORT',
        descriptionKey: 'REPORTS.DESC.DRIVER_REPORT', icon: 'truck',
        permission: 'reportsSecurity.actions.DriverReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'attendance', route: 'attendance', titleKey: 'REPORTS.ITEMS.ATTENDANCE',
        descriptionKey: 'REPORTS.DESC.ATTENDANCE', icon: 'clock',
        permission: 'reportsSecurity.actions.AttendenceReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Suppliers ────────────────────────────────────────────────────────────
  {
    key: 'suppliers',
    titleKey: 'REPORTS.GROUPS.SUPPLIERS',
    icon: 'truck',
    reports: [
      {
        slug: 'supplier-aging', route: 'supplierAging', titleKey: 'REPORTS.ITEMS.SUPPLIER_AGING',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_AGING', icon: 'clock',
        permission: 'reportsSecurity.actions.SupplierAgingReport.access',
        filters: { asOf: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'supplier-balances', route: 'supplierBalances', titleKey: 'REPORTS.ITEMS.SUPPLIER_BALANCES',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_BALANCES', icon: 'credit-card',
        permission: 'reportsSecurity.actions.SupplierBalanceReport.access',
        filters: { asOf: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Purchase ─────────────────────────────────────────────────────────────
  {
    key: 'purchase',
    titleKey: 'REPORTS.GROUPS.PURCHASE',
    icon: 'shopping-cart',
    reports: [
      {
        slug: 'purchase-by-supplier', route: 'purchaseBySupplier', titleKey: 'REPORTS.ITEMS.PURCHASE_BY_SUPPLIER',
        descriptionKey: 'REPORTS.DESC.PURCHASE_BY_SUPPLIER', icon: 'truck',
        permission: 'reportsSecurity.actions.PurchaseBySupplier.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'purchase-by-item', route: 'purchaseByItem', titleKey: 'REPORTS.ITEMS.PURCHASE_BY_ITEM',
        descriptionKey: 'REPORTS.DESC.PURCHASE_BY_ITEM', icon: 'box',
        permission: 'reportsSecurity.actions.PurchaseByItem.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Tax ──────────────────────────────────────────────────────────────────
  {
    key: 'tax',
    titleKey: 'REPORTS.GROUPS.TAX',
    icon: 'percent',
    reports: [
      {
        slug: 'vat-report', route: 'vatReport', titleKey: 'REPORTS.ITEMS.VAT_REPORT',
        descriptionKey: 'REPORTS.DESC.VAT_REPORT', icon: 'percent',
        permission: 'reportsSecurity.actions.VatReport.access',
        filters: { date: true, branches: true }, canSchedule: true, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'vat-audit', route: 'vatAudit', titleKey: 'REPORTS.ITEMS.VAT_AUDIT',
        descriptionKey: 'REPORTS.DESC.VAT_AUDIT', icon: 'file-text',
        permission: 'reportsSecurity.actions.VatAuditReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },

  // ── Others ───────────────────────────────────────────────────────────────
  {
    key: 'others',
    titleKey: 'REPORTS.GROUPS.OTHERS',
    icon: 'grid',
    reports: [
      {
        slug: 'payment-method', route: 'paymentMethod', titleKey: 'REPORTS.ITEMS.PAYMENT_METHOD',
        descriptionKey: 'REPORTS.DESC.PAYMENT_METHOD', icon: 'credit-card',
        permission: 'reportsSecurity.actions.PaymentMethodReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
        chart: { type: 'donut', labelKey: 'label', series: [{ key: 'amount', nameKey: 'REPORTS.KPI.AMOUNT' }] },
      },
      {
        slug: 'discount-report', route: 'discountReport', titleKey: 'REPORTS.ITEMS.DISCOUNT_REPORT',
        descriptionKey: 'REPORTS.DESC.DISCOUNT_REPORT', icon: 'percent',
        permission: 'reportsSecurity.actions.DiscountReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'void-transactions', route: 'voidTransactions', titleKey: 'REPORTS.ITEMS.VOID_TRANSACTIONS',
        descriptionKey: 'REPORTS.DESC.VOID_TRANSACTIONS', icon: 'file-text',
        permission: 'reportsSecurity.actions.VoidRansactions.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true },
      },
    ],
  },
];

/** Flat list of every report — convenient for lookups. */
export const ALL_REPORTS: ReportMeta[] = REPORT_CATALOG.flatMap(g => g.reports);

/** Find a report by its URL slug. */
export function findReport(slug: string): { meta: ReportMeta; group: ReportGroup } | undefined {
  for (const group of REPORT_CATALOG) {
    const meta = group.reports.find(r => r.slug === slug);
    if (meta) return { meta, group };
  }
  return undefined;
}
