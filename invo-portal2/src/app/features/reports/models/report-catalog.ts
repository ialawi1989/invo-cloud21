import { EMPLOYEE_EARNINGS_REPORTS } from './employee-earnings-reports';
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
/** Date the Business Overview reports were rebuilt as dedicated pages — shows them under "New" for 30 days. */
const BO_REBUILT = '2026-11-09';

export const REPORT_CATALOG: ReportGroup[] = [
  // ── Business Overview ──────────────────────────────────────────────────────
  {
    key: 'business-overview',
    titleKey: 'REPORTS.GROUPS.BUSINESS_OVERVIEW',
    icon: 'book',
    reports: [
      // The five reports below render through dedicated pages
      // (`business-overview/`, routed ahead of the generic shell). Routes are the real backend
      // data routes; export paths differ for some (see business-overview.config.ts).
      {
        slug: 'profit-and-loss', route: 'profitAndLossReport', updated: BO_REBUILT,
        titleKey: 'REPORTS.ITEMS.PROFIT_AND_LOSS', descriptionKey: 'REPORTS.DESC.PROFIT_AND_LOSS',
        icon: 'trending-up', permission: 'reportsSecurity.actions.ProfitandLoss.access',
        filters: { date: true, branches: true, compare: true }, canSchedule: true,
        export: { pdf: true, xlsx: true, path: 'profitAndLoss' }, starredByDefault: true,
      },
      {
        slug: 'balance-sheet', route: 'balanceSheetReport', updated: BO_REBUILT,
        titleKey: 'REPORTS.ITEMS.BALANCE_SHEET', descriptionKey: 'REPORTS.DESC.BALANCE_SHEET',
        icon: 'book', permission: 'reportsSecurity.actions.BalanceSheet.access',
        filters: { asOf: true, asOfOptional: true, branches: true, compare: true }, canSchedule: true,
        export: { pdf: true, xlsx: true, path: 'balanceSheet' },
      },
      {
        slug: 'trial-balance', route: 'trialBalanceReport', updated: BO_REBUILT,
        titleKey: 'REPORTS.ITEMS.TRIAL_BALANCE', descriptionKey: 'REPORTS.DESC.TRIAL_BALANCE',
        icon: 'file-text', permission: 'reportsSecurity.actions.TrialBalanceBasisAccrual.access',
        filters: { asOf: true, asOfOptional: true, branches: true, compare: true },
        export: { pdf: true, xlsx: true, path: 'trialBalanceReport' },
      },
      {
        slug: 'journal-entries', route: 'journalEntriesReports', updated: BO_REBUILT,
        titleKey: 'REPORTS.ITEMS.JOURNAL_ENTRIES', descriptionKey: 'REPORTS.DESC.JOURNAL_ENTRIES',
        icon: 'file-text', permission: 'reportsSecurity.actions.JournalEntries.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'journalEntries' },
      },
      {
        slug: 'general-ledger', route: 'generalLedgerReport', updated: BO_REBUILT,
        titleKey: 'REPORTS.ITEMS.GENERAL_LEDGER', descriptionKey: 'REPORTS.DESC.GENERAL_LEDGER',
        icon: 'book', permission: 'reportsSecurity.actions.GeneralLedgerReport.access',
        filters: { date: true, branches: true, compare: true },
        export: { pdf: true, xlsx: true, path: 'generalLedgerReport' },
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
        // The page loads through the `summary/*` routes (see SalesSummaryService); `salesSummary` is export-only.
        slug: 'sales-summary', route: 'summary/static', customBody: 'sales-summary',
        titleKey: 'REPORTS.ITEMS.SALES_SUMMARY', descriptionKey: 'REPORTS.DESC.SALES_SUMMARY',
        icon: 'trending-up', permission: 'reportsSecurity.actions.SalesSummary.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, canSchedule: true,
        export: { pdf: true, xlsx: true, path: 'salesSummary' }, starredByDefault: true, updated: RECENT,
      },
      {
        slug: 'sales-by-department', route: 'salesByDepartments', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.SALES_BY_DEPARTMENT', descriptionKey: 'REPORTS.DESC.SALES_BY_DEPARTMENT',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByDepartment.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true, subColumns: true }, export: { pdf: true, xlsx: true, path: 'salesByDepartment' }, updated: RECENT,
      },
      {
        slug: 'sales-by-category', route: 'salesByCategoryReport', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.SALES_BY_CATEGORY', descriptionKey: 'REPORTS.DESC.SALES_BY_CATEGORY',
        icon: 'pie-chart', permission: 'reportsSecurity.actions.SalesByCategoryReport.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true, subColumns: true }, export: { pdf: true, xlsx: true, path: 'salesByCategory' }, updated: RECENT,
      },
      {
        // Loads through `salesByItemReport` (paged + sorted by the backend); the export is `salesByProduct`.
        slug: 'sales-by-product', route: 'salesByItemReport', customBody: 'sales-by-product',
        titleKey: 'REPORTS.ITEMS.SALES_BY_PRODUCT', descriptionKey: 'REPORTS.DESC.SALES_BY_PRODUCT',
        icon: 'box', permission: 'reportsSecurity.actions.SalesByItemReport.access',
        filters: { date: true, branches: true, products: true, sources: ['CallCenter', 'Cloud', 'POS', 'Online'], applyOpeningHour: true },
        export: { pdf: true, xlsx: true, path: 'salesByProduct' }, updated: RECENT,
      },
      {
        // Grouped by category with a subtotal each; paged by the backend. Export: `salesByProductCategory`.
        slug: 'sales-by-products-category', route: 'salesByProductCategory', customBody: 'products-category',
        titleKey: 'REPORTS.ITEMS.SALES_BY_PRODUCTS_CATEGORY', descriptionKey: 'REPORTS.DESC.SALES_BY_PRODUCTS_CATEGORY',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByProductsCategory.access',
        filters: { date: true, branches: true, products: true, categories: true, applyOpeningHour: true },
        export: { pdf: true, xlsx: true, path: 'salesByProductCategory' }, updated: RECENT,
      },
      {
        // The options sold with each menu product; paged + sorted by the backend. Export: `salesByProductVsOptions`.
        slug: 'sales-by-menu-products-vs-options', route: 'salesByMenuProductVsOptions', customBody: 'products-vs-options',
        titleKey: 'REPORTS.ITEMS.SALES_BY_MENU_PRODUCTS_VS_OPTIONS', descriptionKey: 'REPORTS.DESC.SALES_BY_MENU_PRODUCTS_VS_OPTIONS',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByMenuProductsVsOptions.access',
        filters: { date: true, branches: true, applyOpeningHour: true },
        export: { pdf: true, xlsx: true, path: 'salesByProductVsOptions' }, updated: RECENT,
      },
      {
        slug: 'sales-by-service', route: 'salesByServices', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.SALES_BY_SERVICE', descriptionKey: 'REPORTS.DESC.SALES_BY_SERVICE',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByService.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true, subColumns: true }, export: { pdf: true, xlsx: true, path: 'salesByService' }, updated: RECENT,
      },
      {
        slug: 'sales-by-menu-product-vs-service', route: 'salesByMenuProductVsService', customBody: 'sales-by-product-vs-service',
        titleKey: 'REPORTS.ITEMS.SALES_BY_PRODUCT_VS_SERVICE', descriptionKey: 'REPORTS.DESC.SALES_BY_PRODUCT_VS_SERVICE',
        icon: 'layers', permission: 'reportsSecurity.actions.SalesByMenuProductVsService.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'salesByProductVsService' },
      },
      {
        slug: 'sales-by-menu', route: 'salesByMenuReport', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.SALES_BY_MENU', descriptionKey: 'REPORTS.DESC.SALES_BY_MENU',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByMenu.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true, subColumns: true }, export: { pdf: true, xlsx: true, path: 'salesByMenu' }, updated: RECENT,
        note: { key: 'REPORTS.NOTES.SALES_BY_MENU', type: 'warning' },
      },
      {
        slug: 'sales-by-menu-sections', route: 'salesByMenuSectionsReport', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.SALES_BY_MENU_SECTIONS', descriptionKey: 'REPORTS.DESC.SALES_BY_MENU_SECTIONS',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByMenuSections.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true, subColumns: true }, export: { pdf: true, xlsx: true, path: 'salesByMenuSections' }, updated: RECENT,
        note: { key: 'REPORTS.NOTES.SALES_BY_MENU_SECTIONS', type: 'warning' },
      },
      {
        slug: 'sales-by-terminal', route: 'salesByTerminals', customBody: 'sales-by-terminal',
        titleKey: 'REPORTS.ITEMS.SALES_BY_TERMINAL', descriptionKey: 'REPORTS.DESC.SALES_BY_TERMINAL',
        icon: 'grid', permission: 'reportsSecurity.actions.SalesByTerminal.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'salesByTerminal' },
        note: { key: 'REPORTS.NOTES.SALES_BY_TERMINAL', type: 'warning' },
      },
      {
        slug: 'sales-by-delivery-area', route: 'getSalesByDeliveryArea', customBody: 'sales-by-delivery-area',
        titleKey: 'REPORTS.ITEMS.SALES_BY_DELIVERY_AREA', descriptionKey: 'REPORTS.DESC.SALES_BY_DELIVERY_AREA',
        icon: 'truck', permission: 'reportsSecurity.actions.SalesByDeliveryArea.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'salesByDeliveryArea' },
        note: { key: 'REPORTS.NOTES.SALES_BY_TERMINAL', type: 'warning' },
      },
      {
        slug: 'sales-by-aggregator', route: 'salesByAggregatorReport', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.SALES_BY_AGGREGATOR', descriptionKey: 'REPORTS.DESC.SALES_BY_AGGREGATOR',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByAggregatorReport.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true, subColumns: true }, export: { pdf: true, xlsx: true, path: 'salesByAggregator' }, updated: RECENT,
      },
      {
        slug: 'sales-by-invoice', route: 'salesByInvoice', customBody: 'sales-by-invoice',
        titleKey: 'REPORTS.ITEMS.SALES_BY_INVOICE', descriptionKey: 'REPORTS.DESC.SALES_BY_INVOICE',
        icon: 'file-text', permission: 'reportsSecurity.actions.SalesByInvoice.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'salesByInvoice' },
      },
      {
        slug: 'daily-closing-report', route: 'getdailySalesReport', customBody: 'daily-closing',
        titleKey: 'REPORTS.ITEMS.DAILY_CLOSING', descriptionKey: 'REPORTS.DESC.DAILY_CLOSING',
        icon: 'calendar', permission: 'reportsSecurity.actions.SalesBreakdownDailyClosing.access',
        filters: { asOf: true, branches: true, singleBranch: true, requireBranch: true, sources: ['CallCenter', 'Cloud', 'POS', 'Online'] },
        export: { pdf: true, xlsx: true, path: 'dailyClosingReport' },
      },
      {
        slug: 'sales-by-brands', route: 'salesByBrand', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.SALES_BY_BRANDS', descriptionKey: 'REPORTS.DESC.SALES_BY_BRANDS',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByBrands.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true, subColumns: true }, export: { pdf: true, xlsx: true, path: 'salesByBrand' }, updated: RECENT,
      },
      {
        slug: 'department-sales-and-payments-overview', route: 'departmentSalesAndPaymentsOverview', customBody: 'department-sales-payments',
        titleKey: 'REPORTS.ITEMS.DEPARTMENT_SALES_PAYMENTS', descriptionKey: 'REPORTS.DESC.DEPARTMENT_SALES_PAYMENTS',
        icon: 'credit-card', permission: 'reportsSecurity.actions.DepartmentSalesAndPaymentsOverviewReport.access',
        filters: { date: true, branches: true, filterBy: ['category', 'department', 'brand'] },
        export: { xlsx: true, path: 'departmentSalesAndPaymentsOverview' },
        note: { key: 'REPORTS.NOTES.SALES_BY_MENU', type: 'warning' },
      },
      {
        slug: 'sales-by-hours-by-product', route: 'salesByHoursbyProduct', customBody: 'sales-by-hours-by-product',
        titleKey: 'REPORTS.ITEMS.SALES_BY_HOURS_BY_PRODUCT', descriptionKey: 'REPORTS.DESC.SALES_BY_HOURS_BY_PRODUCT',
        icon: 'clock', permission: 'reportsSecurity.actions.SalesByHoursByProduct.access',
        filters: { date: true, branches: true, products: true, applyOpeningHour: true },
        export: { pdf: true, xlsx: true, path: 'salesByHoursbyProduct' },
      },
      {
        slug: 'voided-sales', route: 'voidedSalesReport', customBody: 'voided-sales',
        titleKey: 'REPORTS.ITEMS.VOIDED_SALES', descriptionKey: 'REPORTS.DESC.VOIDED_SALES',
        icon: 'file-text', permission: 'reportsSecurity.actions.VoidedSales.access',
        filters: { date: true, branches: true, categories: true, products: true, voidedBy: true, voidReasons: true, voidTimings: true, applyOpeningHour: true },
        export: { pdf: true, xlsx: true, path: 'voidedSales' },
        note: { key: 'REPORTS.NOTES.VOIDED_SALES', type: 'info' },
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
        slug: 'customer-order-history', route: 'customerOrderHistoryReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.CUSTOMER_ORDER_HISTORY',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_ORDER_HISTORY', icon: 'users',
        permission: 'reportsSecurity.actions.CustomerOrderHistory.access',
        filters: {
          date: true, branches: true, customers: true, customerType: true,
        }, export: { pdf: true, xlsx: true, path: 'customerOrderHistory' },
      },
      {
        slug: 'sales-by-customers-summary', route: 'salesByCustomer', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SALES_BY_CUSTOMERS_SUMMARY',
        descriptionKey: 'REPORTS.DESC.SALES_BY_CUSTOMERS_SUMMARY', icon: 'bar-chart',
        permission: 'reportsSecurity.actions.SalesByCustomersSummary.access',
        filters: {
          date: true, branches: true, customers: true, customerType: true,
        }, export: { pdf: true, xlsx: true, path: 'salesByCustomer' },
      },
      {
        slug: 'customer-balance-summary', route: 'customerBalance', customBody: 'flat', titleKey: 'REPORTS.ITEMS.CUSTOMER_BALANCE_SUMMARY',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_BALANCE_SUMMARY', icon: 'credit-card',
        permission: 'reportsSecurity.actions.CustomerBalanceSummary.access',
        filters: {
          asOf: true, branches: true, customers: true, hasBalanceOnly: true, customerType: true,
        }, export: { pdf: true, xlsx: true, path: 'customerBalanceSummary' },
      },
      {
        slug: 'customer-aging', route: 'customerAgingReports', customBody: 'customer-aging', titleKey: 'REPORTS.ITEMS.CUSTOMER_AGING',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_AGING', icon: 'clock',
        permission: 'reportsSecurity.actions.CustomerAgingReport.access',
        filters: { asOf: true, branches: true, customers: true, customerType: true }, export: { pdf: true, xlsx: true, path: 'customerAgingReport' },
      },
      {
        slug: 'customer-aging-summary', route: 'customerSummaryAgingReports', customBody: 'customer-aging-summary', titleKey: 'REPORTS.ITEMS.CUSTOMER_AGING_SUMMARY',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_AGING_SUMMARY', icon: 'layers',
        permission: 'reportsSecurity.actions.CustomerAgingSummaryReport.access',
        filters: { asOf: true, branches: true, customers: true, customerType: true }, export: { pdf: true, xlsx: true, path: 'customerAgingSummaryReport' },
      },
      {
        slug: 'payment-received', route: 'paymentReceived', customBody: 'flat', titleKey: 'REPORTS.ITEMS.PAYMENT_RECEIVED',
        descriptionKey: 'REPORTS.DESC.PAYMENT_RECEIVED', icon: 'credit-card',
        permission: 'reportsSecurity.actions.PaymentReceivedReport.access',
        filters: {
          date: true, branches: true, customers: true, customerType: true,
          filterBy: ['None', 'Customer', 'Payment Method'], filterByKey: 'groupBy', filterByLabel: 'REPORTS.FILTER.GROUP_BY',
        }, export: { pdf: true, xlsx: true, path: 'paymentReceived' },
      },
      {
        slug: 'credit-notes', route: 'creditNoteReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.CREDIT_NOTES',
        descriptionKey: 'REPORTS.DESC.CREDIT_NOTES', icon: 'file-text',
        permission: 'reportsSecurity.actions.CreditNotesReport.access',
        filters: { date: true, branches: true, customers: true, customerType: true }, export: { pdf: true, xlsx: true, path: 'creditNoteReport' },
      },
      {
        slug: 'refunds', route: 'refundReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.REFUNDS',
        descriptionKey: 'REPORTS.DESC.REFUNDS', icon: 'trending-up',
        permission: 'reportsSecurity.actions.RefundsReport.access',
        filters: {
          date: true, branches: true, customers: true, customerType: true,
          filterBy: ['None', 'Customer', 'Payment Method'], filterByKey: 'groupBy', filterByLabel: 'REPORTS.FILTER.GROUP_BY',
        }, export: { pdf: true, xlsx: true, path: 'refundReport' },
      },
      {
        slug: 'customer-wise-item-sales', route: 'customerWiseItemSalesReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.CUSTOMER_WISE_ITEM_SALES',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_WISE_ITEM_SALES', icon: 'box',
        permission: 'reportsSecurity.actions.ClientWiseItemSalesReport.access',
        filters: {
          date: true, branches: true, customers: true, customerType: true, products: true, applyOpeningHour: true,
          filterBy: ['Customer', 'None'], filterByKey: 'groupBy', filterByLabel: 'REPORTS.FILTER.GROUP_BY',
        }, export: { pdf: true, xlsx: true, path: 'customerWiseItemSalesReport' },
      },
      {
        slug: 'customer-wise-discount', route: 'customerWiseDiscountReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.CUSTOMER_WISE_DISCOUNT',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_WISE_DISCOUNT', icon: 'percent',
        permission: 'reportsSecurity.actions.ClientWiseDiscountReport.access',
        filters: {
          date: true, branches: true, customers: true, customerType: true, products: true,
          filterBy: ['Customer', 'None'], filterByKey: 'groupBy', filterByLabel: 'REPORTS.FILTER.GROUP_BY',
        }, export: { pdf: true, xlsx: true, path: 'customerWiseDiscountReport' },
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
        slug: 'general-inventory', route: 'getGeneralInventoryReport', customBody: 'general-inventory', titleKey: 'REPORTS.ITEMS.GENERAL_INVENTORY',
        descriptionKey: 'REPORTS.DESC.GENERAL_INVENTORY', icon: 'box',
        permission: 'reportsSecurity.actions.GeneralInventoryReport.access',
        filters: { date: true, branches: true, categories: true, locations: true, hideDeleted: true }, export: { pdf: true, xlsx: true, path: 'generalInventoryReport' },
      },
      {
        slug: 'product-movement', route: 'productMovementReport', customBody: 'product-movement', titleKey: 'REPORTS.ITEMS.PRODUCT_MOVEMENT',
        descriptionKey: 'REPORTS.DESC.PRODUCT_MOVEMENT', icon: 'layers',
        permission: 'reportsSecurity.actions.ProductMovment.access',
        filters: { date: true, branches: true, products: true, singleProduct: true, requireProduct: true }, export: { pdf: true, xlsx: true, path: 'productMovment' },
      },
      {
        slug: 'inventory-transfer', route: 'inventoryTransferReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.INVENTORY_TRANSFER',
        descriptionKey: 'REPORTS.DESC.INVENTORY_TRANSFER', icon: 'truck',
        permission: 'reportsSecurity.actions.InventoryTransferReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'inventoryTransferReport' },
      },
      {
        slug: 'wastage-summary', route: 'wastageSummaryReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.WASTAGE_SUMMARY',
        descriptionKey: 'REPORTS.DESC.WASTAGE_SUMMARY', icon: 'layers',
        permission: 'reportsSecurity.actions.WastageSummaryReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'wastageSummaryReport' },
      },
      {
        slug: 'detailed-wastage', route: 'productWastageReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.DETAILED_WASTAGE',
        descriptionKey: 'REPORTS.DESC.DETAILED_WASTAGE', icon: 'layers',
        permission: 'reportsSecurity.actions.DetailedWastageReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'wastageReport' },
      },
      {
        slug: 'expired-products', route: 'expiredProductsReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.EXPIRED_PRODUCTS',
        descriptionKey: 'REPORTS.DESC.EXPIRED_PRODUCTS', icon: 'clock',
        permission: 'reportsSecurity.actions.ExpiredProductsReport.access',
        filters: { branches: true }, export: { pdf: true, xlsx: true, path: 'expiredProductsReport' },
      },
      {
        slug: 'reorder-report', route: 'reorderReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.REORDER_REPORT',
        descriptionKey: 'REPORTS.DESC.REORDER_REPORT', icon: 'shopping-cart',
        permission: 'reportsSecurity.actions.ReorderReport.access',
        filters: { branches: true }, export: { pdf: true, xlsx: true, path: 'reorderReport' },
      },
      {
        slug: 'reorder-alert', route: 'reorderAlertReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.REORDER_ALERT',
        descriptionKey: 'REPORTS.DESC.REORDER_ALERT', icon: 'trending-up',
        permission: 'reportsSecurity.actions.ReorderAlertReport.access',
        filters: {
          branches: true, productTypes: ['inventory', 'batch', 'serialized', 'kit', 'tailoring'],
          locations: true, locationsKey: 'locations',
          filterBy: ['None', 'Normal', 'Low Stock', 'Critical'], filterByKey: 'stockStatus', filterByLabel: 'REPORTS.FILTER.STOCK_STATUS',
        }, export: { xlsx: true, path: 'reorderAlertReport' },
      },
      {
        slug: 'sales-vs-inventory-usage', route: 'salesVsInventoryUsageReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SALES_VS_INVENTORY_USAGE',
        descriptionKey: 'REPORTS.DESC.SALES_VS_INVENTORY_USAGE', icon: 'bar-chart',
        permission: 'reportsSecurity.actions.SalesVsInventoryUsage.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'salesVsInventoryUsage' },
      },
      {
        slug: 'product-sales-vs-inventory-usage', route: 'productSalesVsInventoryUsageReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.PRODUCT_SALES_VS_INVENTORY_USAGE',
        descriptionKey: 'REPORTS.DESC.PRODUCT_SALES_VS_INVENTORY_USAGE', icon: 'bar-chart',
        permission: 'reportsSecurity.actions.ProductSalesVsInventoryUsage.access',
        filters: { date: true, branches: true, products: true }, export: { pdf: true, xlsx: true, path: 'productSalesVsInventoryUsage' },
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
        slug: 'purchase-by-supplier', route: 'purchaseBySupplier', customBody: 'flat', titleKey: 'REPORTS.ITEMS.PURCHASE_BY_SUPPLIER',
        descriptionKey: 'REPORTS.DESC.PURCHASE_BY_SUPPLIER', icon: 'truck',
        permission: 'reportsSecurity.actions.PurchaseBySupplier.access',
        filters: { date: true, branches: true, purchaseMode: true }, export: { pdf: true, xlsx: true, path: 'purchaseBySupplier' },
      },
      {
        slug: 'purchase-by-item', route: 'purchaseByItem', customBody: 'comparison', titleKey: 'REPORTS.ITEMS.PURCHASE_BY_ITEM',
        descriptionKey: 'REPORTS.DESC.PURCHASE_BY_ITEM', icon: 'box',
        permission: 'reportsSecurity.actions.PurchaseByItem.access',
        filters: {
          date: true, branches: true, comparePeriods: true, subColumns: true, purchaseMode: true,
          filterBy: ['None', 'Supplier', 'Category'], filterByKey: 'groupBy', filterByLabel: 'REPORTS.FILTER.GROUP_BY',
        },
        export: { pdf: true, xlsx: true, path: 'purchaseByItem' },
      },
      {
        slug: 'purchase-by-category', route: 'purchaseByCategory', customBody: 'comparison',
        titleKey: 'REPORTS.ITEMS.PURCHASE_BY_CATEGORY', descriptionKey: 'REPORTS.DESC.PURCHASE_BY_CATEGORY',
        icon: 'bar-chart', permission: 'reportsSecurity.actions.PurchaseByCategory.access',
        filters: { date: true, branches: true, comparePeriods: true, subColumns: true, purchaseMode: true }, export: { pdf: true, xlsx: true, path: 'purchaseByCategory' }, updated: RECENT,
      },
      {
        slug: 'open-pending-po', route: 'openPendingPOReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.OPEN_PENDING_PO',
        descriptionKey: 'REPORTS.DESC.OPEN_PENDING_PO', icon: 'shopping-cart',
        permission: 'reportsSecurity.actions.OpenPendingPOReport.access',
        filters: { date: true, branches: true, purchaseMode: true }, export: { pdf: true, xlsx: true, path: 'openPendingPOReport' },
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
        slug: 'cashier-report', route: 'cashierList', customBody: 'cashier-shifts', titleKey: 'REPORTS.ITEMS.CASHIER_REPORT',
        descriptionKey: 'REPORTS.DESC.CASHIER_REPORT', icon: 'user-check',
        permission: 'reportsSecurity.actions.CashierReport.access',
        filters: { date: true, branches: true, singleBranch: true }, export: { pdf: true, xlsx: true, path: 'cashierReportByCashierId' },
      },
      {
        slug: 'cashier-summary-report', route: 'getCashierReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.CASHIER_SUMMARY',
        descriptionKey: 'REPORTS.DESC.CASHIER_SUMMARY', icon: 'user-check',
        permission: 'reportsSecurity.actions.CashierSummaryReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'cashierReport' },
      },
      {
        slug: 'sales-by-employee', route: 'salesByEmployeeReport', customBody: 'flat',
        titleKey: 'REPORTS.ITEMS.SALES_BY_EMPLOYEE', descriptionKey: 'REPORTS.DESC.SALES_BY_EMPLOYEE',
        icon: 'user-check', permission: 'reportsSecurity.actions.SalesByEmployee.access',
        filters: { date: true, branches: true, applyOpeningHour: true, salesEmployee: true }, export: { pdf: true, xlsx: true, path: 'salesByEmployee' },
      },
      {
        slug: 'sales-by-employee-vs-products', route: 'salesByProductVsEmployee', customBody: 'flat',
        titleKey: 'REPORTS.ITEMS.SALES_BY_EMPLOYEE_VS_PRODUCTS', descriptionKey: 'REPORTS.DESC.SALES_BY_EMPLOYEE_VS_PRODUCTS',
        icon: 'users', permission: 'reportsSecurity.actions.SalesByEmployeeVsProducts.access',
        filters: { date: true, branches: true, applyOpeningHour: true, salesEmployee: true }, export: { pdf: true, xlsx: true, path: 'salesByEmployeeVsProducts' },
      },
      {
        slug: 'short-over-report', route: 'shortOver', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SHORT_OVER',
        descriptionKey: 'REPORTS.DESC.SHORT_OVER', icon: 'scale',
        permission: 'reportsSecurity.actions.ShortOverReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'shortOver' },
      },
      {
        slug: 'customer-table-by-employee', route: 'customerTableByEmployee', customBody: 'flat', titleKey: 'REPORTS.ITEMS.CUSTOMER_TABLE_BY_EMPLOYEE',
        descriptionKey: 'REPORTS.DESC.CUSTOMER_TABLE_BY_EMPLOYEE', icon: 'users',
        permission: 'reportsSecurity.actions.CustomerTableByEmployee.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'customerTableByEmployee' },
      },
      {
        slug: 'driver-report', route: 'getDriverReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.DRIVER_REPORT',
        descriptionKey: 'REPORTS.DESC.DRIVER_REPORT', icon: 'truck',
        permission: 'reportsSecurity.actions.DriverReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'driverSummaryReport' },
      },
      {
        slug: 'driver-details-report', route: 'getDriverDetailsReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.DRIVER_DETAILS',
        descriptionKey: 'REPORTS.DESC.DRIVER_DETAILS', icon: 'truck',
        permission: 'reportsSecurity.actions.DriverDetailsReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'driverReport' },
      },
      // Commission & tips: opt-in per company (Settings → Commission & Tips). No export endpoints exist for them yet.
      ...EMPLOYEE_EARNINGS_REPORTS,
    ],
  },

  // ── Attendance ───────────────────────────────────────────────────────────
  {
    key: 'attendance',
    titleKey: 'REPORTS.GROUPS.ATTENDANCE',
    icon: 'clock',
    reports: [
      {
        slug: 'attendance', route: 'getAttendanceReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATTENDANCE',
        descriptionKey: 'REPORTS.DESC.ATTENDANCE', icon: 'clock',
        permission: 'reportsSecurity.actions.AttendenceReport.access',
        filters: { date: true, branches: true, singleBranch: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendenceReport' },
      },
      {
        slug: 'missing-punches', route: '/attendance/missingPunches', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATT_MISSING_PUNCHES',
        descriptionKey: 'REPORTS.DESC.ATT_MISSING_PUNCHES', icon: 'alert-triangle',
        permission: 'reportsSecurity.actions.AttendanceMissingPunches.access',
        filters: { date: false, branches: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendance/missingPunches' },
      },
      {
        slug: 'hours-summary', route: '/attendance/hoursSummary', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATT_HOURS_SUMMARY',
        descriptionKey: 'REPORTS.DESC.ATT_HOURS_SUMMARY', icon: 'clock',
        permission: 'reportsSecurity.actions.AttendanceHoursSummary.access',
        filters: { date: true, branches: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendance/hoursSummary' },
      },
      {
        slug: 'overtime', route: '/attendance/overtime', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATT_OVERTIME',
        descriptionKey: 'REPORTS.DESC.ATT_OVERTIME', icon: 'trending-up',
        permission: 'reportsSecurity.actions.AttendanceOvertime.access',
        filters: { date: true, branches: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendance/overtime' },
      },
      {
        slug: 'late-and-early', route: '/attendance/lateAndEarly', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATT_LATE_EARLY',
        descriptionKey: 'REPORTS.DESC.ATT_LATE_EARLY', icon: 'clock',
        permission: 'reportsSecurity.actions.AttendanceLateAndEarly.access',
        filters: { date: true, branches: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendance/lateAndEarly' },
      },
      {
        slug: 'attendance-audit', route: 'attendance/audit', customBody: 'attendance-audit', titleKey: 'REPORTS.ITEMS.ATT_AUDIT',
        descriptionKey: 'REPORTS.DESC.ATT_AUDIT', icon: 'file-text',
        permission: 'reportsSecurity.actions.AttendanceAudit.access',
        filters: { date: true, branches: true, singleEmployee: true, singleEmployeeKey: 'adjustedBy', singleEmployeeLabel: 'REPORTS.FILTER.ADJUSTED_BY' }, export: { pdf: true, xlsx: true, path: 'attendance/audit' },
      },
      {
        slug: 'daily-sheet', route: '/attendance/dailySheet', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATT_DAILY_SHEET',
        descriptionKey: 'REPORTS.DESC.ATT_DAILY_SHEET', icon: 'calendar',
        permission: 'reportsSecurity.actions.AttendanceDailySheet.access',
        filters: { date: false, branches: true }, export: { pdf: true, xlsx: true, path: 'attendance/dailySheet' },
      },
      {
        slug: 'absence', route: 'attendance/absence', customBody: 'attendance-absence', titleKey: 'REPORTS.ITEMS.ATT_ABSENCE',
        descriptionKey: 'REPORTS.DESC.ATT_ABSENCE', icon: 'user-x',
        permission: 'reportsSecurity.actions.AttendanceAbsence.access',
        filters: { date: true, branches: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendance/absence' },
      },
      {
        slug: 'attendance-trends', route: 'attendance/trends', customBody: 'attendance-trends', titleKey: 'REPORTS.ITEMS.ATT_TRENDS',
        descriptionKey: 'REPORTS.DESC.ATT_TRENDS', icon: 'grid',
        permission: 'reportsSecurity.actions.AttendanceTrends.access',
        filters: { date: true, monthOnly: true, branches: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendance/trends' },
      },
      {
        slug: 'branch-comparison', route: '/attendance/branchComparison', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATT_BRANCH_COMPARISON',
        descriptionKey: 'REPORTS.DESC.ATT_BRANCH_COMPARISON', icon: 'bar-chart',
        permission: 'reportsSecurity.actions.AttendanceBranchComparison.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'attendance/branchComparison' },
      },
      {
        slug: 'scorecard', route: '/attendance/scorecard', customBody: 'flat', titleKey: 'REPORTS.ITEMS.ATT_SCORECARD',
        descriptionKey: 'REPORTS.DESC.ATT_SCORECARD', icon: 'check-circle',
        permission: 'reportsSecurity.actions.AttendanceScorecard.access',
        filters: { date: true, branches: true, singleEmployee: true }, export: { pdf: true, xlsx: true, path: 'attendance/scorecard' },
      },
      {
        slug: 'attendance-detail', route: 'attendance/employeeDetail', customBody: 'attendance-detail', titleKey: 'REPORTS.ITEMS.ATT_EMPLOYEE_DETAIL',
        descriptionKey: 'REPORTS.DESC.ATT_EMPLOYEE_DETAIL', icon: 'user',
        permission: 'reportsSecurity.actions.AttendanceEmployeeDetail.access',
        filters: { date: true, branches: true, singleEmployee: true, requireEmployee: true },
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
        slug: 'supplier-aging', route: 'getSupplierAgingReport', customBody: 'supplier-aging', titleKey: 'REPORTS.ITEMS.SUPPLIER_AGING',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_AGING', icon: 'clock',
        permission: 'reportsSecurity.actions.SupplierAgingReport.access',
        filters: { asOf: true, branches: true, suppliers: true }, export: { pdf: true, xlsx: true, path: 'supplierAgingReport' },
      },
      {
        slug: 'supplier-aging-summary', route: 'supplierAgingReportSummary', customBody: 'supplier-aging-summary', titleKey: 'REPORTS.ITEMS.SUPPLIER_AGING_SUMMARY',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_AGING_SUMMARY', icon: 'layers',
        permission: 'reportsSecurity.actions.SupplierAgingSummaryReport.access',
        filters: { asOf: true, branches: true, suppliers: true }, export: { pdf: true, xlsx: true, path: 'supplierAgingSummaryReport' },
      },
      {
        slug: 'supplier-balances', route: 'supplierBalances', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SUPPLIER_BALANCES',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_BALANCES', icon: 'credit-card',
        permission: 'reportsSecurity.actions.SupplierBalanceReport.access',
        filters: { asOf: true, branches: true, suppliers: true }, export: { pdf: true, xlsx: true, path: 'supplierBalanceSummary' },
      },
      {
        slug: 'payment-made', route: 'paymentMade', customBody: 'flat', titleKey: 'REPORTS.ITEMS.PAYMENT_MADE',
        descriptionKey: 'REPORTS.DESC.PAYMENT_MADE', icon: 'banknote',
        permission: 'reportsSecurity.actions.BillPaymentAndExpenceReport.access',
        filters: {
          date: true, branches: true, suppliers: true,
          filterBy: ['None', 'Supplier', 'Payment Method'], filterByKey: 'groupBy', filterByLabel: 'REPORTS.FILTER.GROUP_BY',
        },
        export: { pdf: true, xlsx: true, path: 'paymentMade' },
      },
      {
        slug: 'supplier-credits', route: 'supplierCreditReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SUPPLIER_CREDITS',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_CREDITS', icon: 'file-text',
        permission: 'reportsSecurity.actions.SupplierCreditsReport.access',
        filters: {
          date: true, branches: true, suppliers: true,
          filterBy: ['None', 'Supplier'], filterByKey: 'groupBy', filterByLabel: 'REPORTS.FILTER.GROUP_BY',
        }, export: { pdf: true, xlsx: true, path: 'supplierCreditReport' },
      },
      {
        slug: 'supplier-refunds', route: 'supplierRefundReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SUPPLIER_REFUNDS',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_REFUNDS', icon: 'rotate-ccw',
        permission: 'reportsSecurity.actions.SupplierRefundsReport.access',
        filters: { date: true, branches: true, suppliers: true }, export: { pdf: true, xlsx: true, path: 'supplierRefundReport' },
      },
      {
        slug: 'supplier-change-price', route: 'supplierChangePriceReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SUPPLIER_CHANGE_PRICE',
        descriptionKey: 'REPORTS.DESC.SUPPLIER_CHANGE_PRICE', icon: 'trending-up',
        permission: 'reportsSecurity.actions.SupplierChangePriceReport.access',
        filters: { date: true, branches: true, suppliers: true }, export: { pdf: true, xlsx: true, path: 'supplierChangePriceReport' },
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
        slug: 'vat-report', route: 'vatReport', customBody: 'vat-report', titleKey: 'REPORTS.ITEMS.VAT_REPORT',
        descriptionKey: 'REPORTS.DESC.VAT_REPORT', icon: 'percent',
        permission: 'reportsSecurity.actions.VatReport.access',
        filters: { date: true, branches: true }, canSchedule: true, export: { pdf: true, xlsx: true },
      },
      {
        slug: 'vat-audit', route: 'vatDetailsReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.VAT_AUDIT',
        descriptionKey: 'REPORTS.DESC.VAT_AUDIT', icon: 'file-text',
        permission: 'reportsSecurity.actions.VatAuditReport.access',
        filters: {
          date: true, branches: true, sources: ['Invoice', 'CreditNotes', 'Bill', 'SupplierCredit', 'Expense', 'Bill Of Entry'],
          sourcesKey: 'types', sourcesLabel: 'REPORTS.FILTER.TRANSACTION_TYPE',
        },
        export: { pdf: true, xlsx: true, path: 'vatDetailsReport' },
      },
      {
        slug: 'product-wise-vat', route: 'productWiseVatReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.PRODUCT_WISE_VAT',
        descriptionKey: 'REPORTS.DESC.PRODUCT_WISE_VAT', icon: 'percent',
        permission: 'reportsSecurity.actions.ProductWiseVatReport.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'productwisevatreport' },
      },
      {
        slug: 'vat-transaction-details', route: 'taxTransactionDetailsReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.VAT_TRANSACTION_DETAILS',
        descriptionKey: 'REPORTS.DESC.VAT_TRANSACTION_DETAILS', icon: 'percent',
        permission: 'reportsSecurity.actions.VatTransactionDetailsReport.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'taxTransactionDetailsReport' },
      },
    ],
  },

  // ── Tables ───────────────────────────────────────────────────────────────
  {
    key: 'tables',
    titleKey: 'REPORTS.GROUPS.TABLES',
    icon: 'grid',
    reports: [
      {
        slug: 'sales-by-tables', route: 'getSalesByTables', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SALES_BY_TABLES',
        descriptionKey: 'REPORTS.DESC.SALES_BY_TABLES', icon: 'grid',
        permission: 'reportsSecurity.actions.SalesByTables.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'SalesByTable' },
      },
      {
        slug: 'sales-by-table-groups', route: 'getSalesByTableGroups', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SALES_BY_TABLE_GROUPS',
        descriptionKey: 'REPORTS.DESC.SALES_BY_TABLE_GROUPS', icon: 'layers',
        permission: 'reportsSecurity.actions.SalesByTableGroups.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'salesByTableGroup' },
      },
      {
        slug: 'table-usage-report', route: 'tableUsage', customBody: 'flat', titleKey: 'REPORTS.ITEMS.TABLE_USAGE',
        descriptionKey: 'REPORTS.DESC.TABLE_USAGE', icon: 'clock',
        permission: 'reportsSecurity.actions.TableUsageReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'tableUsage' },
      },
      {
        slug: 'table-usage-summary-report', route: 'tableUsageSummary', customBody: 'flat', titleKey: 'REPORTS.ITEMS.TABLE_USAGE_SUMMARY',
        descriptionKey: 'REPORTS.DESC.TABLE_USAGE_SUMMARY', icon: 'clock',
        permission: 'reportsSecurity.actions.TableUsageSummaryReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'tableUsageSummary' },
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
        slug: 'daily-sales', route: 'salesByPeriodReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.DAILY_SALES',
        descriptionKey: 'REPORTS.DESC.DAILY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.DailySales.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, requestFilter: { period: 'daily' },
        export: { pdf: true, xlsx: true, path: 'salesByPeriodReport' },
      },
      {
        slug: 'hourly-sales', route: 'salesByPeriodReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.HOURLY_SALES',
        descriptionKey: 'REPORTS.DESC.HOURLY_SALES', icon: 'clock',
        permission: 'reportsSecurity.actions.HourlySales.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, requestFilter: { period: 'hourly' },
        export: { pdf: true, xlsx: true, path: 'salesByPeriodReport' },
      },
      {
        slug: 'weekday-sales', route: 'salesByPeriodReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.WEEKDAY_SALES',
        descriptionKey: 'REPORTS.DESC.WEEKDAY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.WeekdaySales.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, requestFilter: { period: 'weekDay' },
        export: { pdf: true, xlsx: true, path: 'salesByPeriodReport' },
      },
      {
        slug: 'weekly-sales', route: 'salesByPeriodReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.WEEKLY_SALES',
        descriptionKey: 'REPORTS.DESC.WEEKLY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.WeeklySales.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, requestFilter: { period: 'weekly' },
        export: { pdf: true, xlsx: true, path: 'salesByPeriodReport' },
      },
      {
        slug: 'monthly-sales', route: 'salesByPeriodReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.MONTHLY_SALES',
        descriptionKey: 'REPORTS.DESC.MONTHLY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.MonthlySales.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, requestFilter: { period: 'monthly' },
        export: { pdf: true, xlsx: true, path: 'salesByPeriodReport' },
      },
      {
        slug: 'quarterly-sales', route: 'salesByPeriodReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.QUARTERLY_SALES',
        descriptionKey: 'REPORTS.DESC.QUARTERLY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.QuarterlySales.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, requestFilter: { period: 'quartarly' },
        export: { pdf: true, xlsx: true, path: 'salesByPeriodReport' },
      },
      {
        slug: 'yearly-sales', route: 'salesByPeriodReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.YEARLY_SALES',
        descriptionKey: 'REPORTS.DESC.YEARLY_SALES', icon: 'calendar',
        permission: 'reportsSecurity.actions.YearlySales.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, requestFilter: { period: 'yearly' },
        export: { pdf: true, xlsx: true, path: 'salesByPeriodReport' },
      },
    ],
  },

  // ── Discount ─────────────────────────────────────────────────────────────
  {
    key: 'discount',
    titleKey: 'REPORTS.GROUPS.DISCOUNT',
    icon: 'percent',
    reports: [
      {
        slug: 'discount-report', route: 'salesDiscountReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.DISCOUNT_REPORT',
        descriptionKey: 'REPORTS.DESC.DISCOUNT_REPORT', icon: 'percent',
        permission: 'reportsSecurity.actions.DiscountReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'discountReport' },
      },
      {
        slug: 'sales-by-discount', route: 'salesByDiscountId', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SALES_BY_DISCOUNT',
        descriptionKey: 'REPORTS.DESC.SALES_BY_DISCOUNT', icon: 'percent',
        permission: 'reportsSecurity.actions.SalesByDiscountReport.access',
        filters: { date: true, branches: true, discount: true, requireDiscount: true }, export: { pdf: true, xlsx: true, path: 'salesByDiscountId' },
      },
      {
        slug: 'transaction-discount', route: 'transactionDiscountReports', customBody: 'flat', titleKey: 'REPORTS.ITEMS.TRANSACTION_DISCOUNT',
        descriptionKey: 'REPORTS.DESC.TRANSACTION_DISCOUNT', icon: 'percent',
        permission: 'reportsSecurity.actions.TransactionDiscountReport.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'transactionDiscountReport' },
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
        slug: 'payment-method', route: 'getPaymentMethodReport', customBody: 'comparison', titleKey: 'REPORTS.ITEMS.PAYMENT_METHOD',
        descriptionKey: 'REPORTS.DESC.PAYMENT_METHOD', icon: 'credit-card',
        permission: 'reportsSecurity.actions.PaymentMethodReport.access',
        filters: { date: true, branches: true, comparePeriods: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'paymentMethodReport' },
      },
      {
        slug: 'product-prepared-time-summary', route: 'productPreparedTimeSummaryReport', customBody: 'comparison', titleKey: 'REPORTS.ITEMS.PRODUCT_PREPARED_TIME',
        descriptionKey: 'REPORTS.DESC.PRODUCT_PREPARED_TIME', icon: 'clock',
        permission: 'reportsSecurity.actions.ProductPreparedTimeSummary.access',
        filters: { date: true, branches: true, comparePeriods: true }, export: { pdf: true, xlsx: true, path: 'productPreparedtimeSummary' },
      },
      {
        slug: 'prepared-time-summary', route: 'preparedTimeSummaryReport', customBody: 'comparison', titleKey: 'REPORTS.ITEMS.PREPARED_TIME',
        descriptionKey: 'REPORTS.DESC.PREPARED_TIME', icon: 'clock',
        permission: 'reportsSecurity.actions.PreparedTimeSummary.access',
        filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'preparedTimeSummaryReport' },
      },
      {
        slug: 'monthly-bld-breakdown', route: 'monthlyBLDBreakdownReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.MONTHLY_BLD',
        descriptionKey: 'REPORTS.DESC.MONTHLY_BLD', icon: 'calendar',
        permission: 'reportsSecurity.actions.MonthlyBldBreakdownReport.access',
        filters: { date: true, monthOnly: true, branches: true }, export: { pdf: true, xlsx: true, path: 'monthlyBLDBreakdown' },
      },
      {
        slug: 'void-transactions', route: 'voidTransactionsReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.VOID_TRANSACTIONS',
        descriptionKey: 'REPORTS.DESC.VOID_TRANSACTIONS', icon: 'file-text',
        permission: 'reportsSecurity.actions.VoidRansactions.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'voidTransactions' },
      },
      {
        slug: 'unsold-products', route: 'unsoldProductReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.UNSOLD_PRODUCTS',
        descriptionKey: 'REPORTS.DESC.UNSOLD_PRODUCTS', icon: 'box',
        permission: 'reportsSecurity.actions.UnsoldProductsReport.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'unsoldProductReport' },
      },
      {
        slug: 'daily-payment', route: 'dailyPaymentReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.DAILY_PAYMENT',
        descriptionKey: 'REPORTS.DESC.DAILY_PAYMENT', icon: 'credit-card',
        permission: 'reportsSecurity.actions.DailyPaymentReport.access',
        filters: { date: true, branches: true, singleBranch: true, requireBranch: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'dailyPaymentReport' },
      },
      {
        slug: 'payouts', route: 'payoutsReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.PAYOUTS',
        descriptionKey: 'REPORTS.DESC.PAYOUTS', icon: 'banknote',
        permission: 'reportsSecurity.actions.PayoutsReport.access',
        filters: { date: true, branches: true, singleBranch: true, requireBranch: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'payoutsReport' },
      },
      {
        slug: 'surcharge', route: 'surchargeReport', customBody: 'flat', titleKey: 'REPORTS.ITEMS.SURCHARGE',
        descriptionKey: 'REPORTS.DESC.SURCHARGE', icon: 'percent',
        permission: 'reportsSecurity.actions.SurchargeReports.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'surchargeReport' },
      },
      {
        slug: 'delivery-charge', route: 'deliveryCharge', customBody: 'flat', titleKey: 'REPORTS.ITEMS.DELIVERY_CHARGE',
        descriptionKey: 'REPORTS.DESC.DELIVERY_CHARGE', icon: 'truck',
        permission: 'reportsSecurity.actions.DeliveryChargeReport.access',
        filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'deliveryCharge' },
      },
    ],
  },
];

/** Flat list of every report — convenient for lookups. */
export const ALL_REPORTS: ReportMeta[] = REPORT_CATALOG.flatMap(g => g.reports);

/**
 * Reports that exist only behind a link of another report (drill-throughs): they are opened with their own URL and
 * filters but are not listed in the catalog or in "Browse Reports" — as in the legacy app.
 */
export const SUB_REPORTS: ReportMeta[] = [
  {
    // The invoices and credit notes of one service (opened from a Sales by Service row, with the service in the URL).
    slug: 'sales-by-service-details', parent: 'sales-by-service', route: 'salesByServiceId', customBody: 'service-details',
    titleKey: 'REPORTS.ITEMS.SALES_BY_SERVICE_DETAILS', descriptionKey: 'REPORTS.DESC.SALES_BY_SERVICE_DETAILS',
    icon: 'layers', permission: 'reportsSecurity.actions.SalesByService.access',
    filters: { date: true, branches: true, applyOpeningHour: true },
    export: { pdf: true, xlsx: true, path: 'salesByServiceId' },
  },
  {
    // The invoices and credit notes of one aggregator (opened from a Sales by Aggregator row, with its name in the URL).
    slug: 'sales-by-aggregator-sub', parent: 'sales-by-aggregator', route: 'salesByAggregatorSubReport', customBody: 'aggregator-sub',
    titleKey: 'REPORTS.ITEMS.SALES_BY_AGGREGATOR_SUB', descriptionKey: 'REPORTS.DESC.SALES_BY_AGGREGATOR_SUB',
    icon: 'bar-chart', permission: 'reportsSecurity.actions.SalesByAggregatorReport.access',
    filters: { date: true, branches: true, applyOpeningHour: true },
    export: { xlsx: true, path: 'salesByAggregatorSubReport' },
  },
  {
    // The bills of one supplier (opened from a Purchase by Supplier row, with the supplier in the URL).
    slug: 'purchase-by-supplier-sub', parent: 'purchase-by-supplier', route: 'purchaseBySupplierId', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.PURCHASE_BY_SUPPLIER_SUB', descriptionKey: 'REPORTS.DESC.PURCHASE_BY_SUPPLIER_SUB',
    icon: 'truck', permission: 'reportsSecurity.actions.PurchaseBySupplier.access',
    filters: { date: true, branches: true },
    export: { xlsx: true, pdf: true, path: 'purchaseBySupplierId' },
  },
  {
    // The suppliers a product was bought from (opened from a Purchase by Item row, with the product in the URL).
    slug: 'purchase-by-item-sub', parent: 'purchase-by-item', route: 'purchaseByItem', customBody: 'comparison',
    titleKey: 'REPORTS.ITEMS.PURCHASE_BY_ITEM_SUB', descriptionKey: 'REPORTS.DESC.PURCHASE_BY_ITEM_SUB',
    icon: 'box', permission: 'reportsSecurity.actions.PurchaseByItem.access',
    filters: { date: true, branches: true, comparePeriods: true, subColumns: true },
    export: { xlsx: true, path: 'purchaseByItem' },
  },
  {
    // The sales transactions behind the Daily Closing figures (same date, branch and sources).
    slug: 'daily-sales-sub', parent: 'daily-closing-report', route: 'dailySalesSubReport', customBody: 'daily-sales-sub',
    titleKey: 'REPORTS.ITEMS.DAILY_SALES_SUB', descriptionKey: 'REPORTS.DESC.DAILY_SALES_SUB',
    icon: 'file-text', permission: 'reportsSecurity.actions.SalesBreakdownDailyClosing.access',
    filters: { asOf: true, branches: true, singleBranch: true, requireBranch: true, sources: ['CallCenter', 'Cloud', 'POS', 'Online'] },
    export: { xlsx: true, path: 'dailySalesSubReport' },
  },
  {
    // The invoices and credit notes behind one Sales by Product row (opened from it, with the product in the URL).
    slug: 'sales-by-item-transactions', parent: 'sales-by-product', route: 'salesByItemTransactions', customBody: 'item-transactions',
    titleKey: 'REPORTS.ITEMS.SALES_BY_ITEM_TRANSACTIONS', descriptionKey: 'REPORTS.DESC.SALES_BY_ITEM_TRANSACTIONS',
    icon: 'file-text', permission: 'reportsSecurity.actions.SalesByItemReport.access',
    filters: { date: true, branches: true, applyOpeningHour: true, sources: ['CallCenter', 'Cloud', 'POS', 'Online'] },
    export: { pdf: true, xlsx: true, path: 'salesByItemTransactions' },
  },
  {
    // The payments behind one Payment Method row (opened from its Transaction Count, with the method in the URL).
    slug: 'payment-method-sub', parent: 'payment-method', route: 'paymentTransactions', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.PAYMENT_METHOD_SUB', descriptionKey: 'REPORTS.DESC.PAYMENT_METHOD_SUB',
    icon: 'credit-card', permission: 'reportsSecurity.actions.PaymentMethodReport.access',
    filters: { date: true, branches: true, applyOpeningHour: true },
    export: { pdf: true, xlsx: true, path: 'paymentTransactions' },
  },
  {
    // The invoices behind one Surcharge row (opened from its name, with the surcharge in the URL).
    slug: 'surcharge-sub', parent: 'surcharge', route: 'surchargeSubReport', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.SURCHARGE_SUB', descriptionKey: 'REPORTS.DESC.SURCHARGE_SUB',
    icon: 'percent', permission: 'reportsSecurity.actions.SurchargeReports.access',
    filters: { date: true, branches: true, applyOpeningHour: true },
    export: { pdf: true, xlsx: true, path: 'surchargeSubReport' },
  },
  {
    // The invoices and credit notes behind one Delivery Charge row (opened from its city, with the city in the URL).
    slug: 'delivery-charge-by-city', parent: 'delivery-charge', route: 'deliveryChargeByCity', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.DELIVERY_CHARGE_BY_CITY', descriptionKey: 'REPORTS.DESC.DELIVERY_CHARGE_BY_CITY',
    icon: 'truck', permission: 'reportsSecurity.actions.DeliveryChargeReport.access',
    filters: { date: true, branches: true, applyOpeningHour: true },
    export: { pdf: true, xlsx: true, path: 'deliveryChargeByCity' },
  },
  {
    // The bills of entry behind the VAT Report's "Imports subject to VAT paid at customs" row (opened from it; not listed).
    slug: 'bill-of-entry-details-vat', parent: 'vat-report', route: 'billOfEntryDetailsVatReport', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.BILL_OF_ENTRY_VAT', descriptionKey: 'REPORTS.DESC.BILL_OF_ENTRY_VAT', icon: 'file-text',
    permission: 'reportsSecurity.actions.VatReport.access',
    filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'billOfEntryDetailsVatReport' },
  },
  {
    // The tax lines of one product (opened from a Product-wise VAT row, with the product in the URL).
    slug: 'product-wise-vat-sub', parent: 'product-wise-vat', route: 'vatReportByProductId', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.PRODUCT_WISE_VAT_SUB', descriptionKey: 'REPORTS.DESC.PRODUCT_WISE_VAT_SUB',
    icon: 'percent', permission: 'reportsSecurity.actions.ProductWiseVatReport.access',
    filters: { date: true, branches: true, applyOpeningHour: true }, export: { pdf: true, xlsx: true, path: 'productWiseVatReport' },
  },
  {
    // The sales transactions of one tax (opened from a VAT Report sales row).
    slug: 'vat-details-sales', parent: 'vat-report', route: 'salesVatDetailsByVatId', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.VAT_DETAILS_SALES', descriptionKey: 'REPORTS.DESC.VAT_DETAILS_SALES',
    icon: 'percent', permission: 'reportsSecurity.actions.VatReport.access',
    filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'vatDetailsByVatId' },
  },
  {
    // The purchase transactions of one tax, or of the zero-rated / exempt taxes together (opened from a VAT Report purchase row).
    slug: 'vat-details-purchases', parent: 'vat-report', route: 'purchaseVatDetailsByVatId', customBody: 'flat',
    titleKey: 'REPORTS.ITEMS.VAT_DETAILS_PURCHASES', descriptionKey: 'REPORTS.DESC.VAT_DETAILS_PURCHASES',
    icon: 'percent', permission: 'reportsSecurity.actions.VatReport.access',
    filters: { date: true, branches: true }, export: { pdf: true, xlsx: true, path: 'vatDetailsByVatId' },
  },
];

/** Find a report by its URL slug (listed reports first, then the drill-through ones — under the Sales group). */
export function findReport(slug: string): { meta: ReportMeta; group: ReportGroup } | undefined {
  for (const group of REPORT_CATALOG) {
    const meta = group.reports.find(r => r.slug === slug);
    if (meta) return { meta, group };
  }
  const sub = SUB_REPORTS.find(r => r.slug === slug);
  const home = REPORT_CATALOG.find(g => g.key === (sub?.slug.startsWith('purchase') ? 'purchase' : sub?.slug.startsWith('bill-of-entry') || sub?.slug.startsWith('vat-details') || sub?.slug.startsWith('product-wise-vat') ? 'tax' : 'sales'));
  return sub && home ? { meta: sub, group: home } : undefined;
}
