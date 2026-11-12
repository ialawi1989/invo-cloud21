/**
 * The reports that share one layout — one row per department / category / menu …, one column per period (a single
 * `Total` column without a comparison), with sub-columns under each column ("Customize columns") and a Total row.
 * Each is the legacy page's data call, verified against InvoCloudBack `routes/v1/app/reports/reports.ts`.
 * Adding a report of this shape = one entry here + one catalog entry (+ its columns in `columns/report-columns.ts`).
 */
export interface ComparisonReportConfig {
  /** `POST accounts/reports/{route}` */
  route: string;
  /** The record field holding the row's name (`departmentName`, `categoryName` …). */
  nameField: string;
  /** Group the rows under a header + subtotal by one of these record fields, picked by the report filter's `groupBy` value. */
  groupFields?: Record<string, string>;
  /** The record field holding the row's id, and the report its name links to (a drill-through). */
  /** The count sub-columns link to this report (the row's id and name in the URL), like the legacy transaction counts. */
  countDrill?: { idField: string; slug: string; param: string; nameParam?: string };
  drill?: { idField: string; slug: string; /** URL param that carries the row's value (default: the product params of Purchase by Item). */ param?: string; /** Also carry the row's name under this URL param. */ nameParam?: string };
  /** A pie of the distribution per row under the table (the legacy offered it on some reports). */
  chart?: boolean;
  /** Legacy shows a per-row Total column (the row's periods added up) when comparing without sub-columns; amount reports only, never averages. */
  rowTotal?: boolean;
  /** Sub-columns that are counts (shown as whole numbers, not amounts). */
  countSubs?: string[];
  /** Sub-columns that are a ratio of two others (an average price = amount / quantity): the Total row and subtotals recompute it instead of adding the rows' averages. */
  ratioSubs?: Record<string, { amount: string; qty: string }>;
}

/** Purchase by Item sub-columns: the quantities are counts; the labels follow the chosen mode (actual / planned / forecast). */
const PURCHASE_ITEM_COUNTS = ['Qty', 'Ordered Qty', 'FOC Items'];
const PURCHASE_ITEM_RATIOS: Record<string, { amount: string; qty: string }> = {
  'Average Price': { amount: 'Total', qty: 'Qty' },
  'Average Planned Price': { amount: 'Planned Amount', qty: 'Ordered Qty' },
  'Average Forecast Price': { amount: 'Forecast Amount', qty: 'Qty' },
};

export const COMPARISON_REPORTS: Record<string, ComparisonReportConfig> = {
  'sales-by-department':  { route: 'salesByDepartments', rowTotal: true,         nameField: 'departmentName',  chart: true },
  'sales-by-category':    { route: 'salesByCategoryReport', rowTotal: true,      nameField: 'categoryName',    chart: true },
  'sales-by-menu':        { route: 'salesByMenuReport', rowTotal: true,          nameField: 'menuName' },
  'sales-by-menu-sections': { route: 'salesByMenuSectionsReport', rowTotal: true, nameField: 'menuSectionName' },
  'sales-by-aggregator':  { route: 'salesByAggregatorReport', rowTotal: true,    nameField: 'pluginName', drill: { idField: 'pluginName', slug: 'sales-by-aggregator-sub', param: 'aggregatorName' }, countSubs: ['invoiceProdQty', 'creditNoteProdQty'] },
  'sales-by-brands':      { route: 'salesByBrand',               nameField: 'brandName',       chart: true },
  'sales-by-service':     { route: 'salesByServices',            nameField: 'serviceName',     chart: true, drill: { idField: 'serviceId', slug: 'sales-by-service-details', param: 'serviceId', nameParam: 'serviceName' } },
  'purchase-by-category': { route: 'purchaseByCategory', rowTotal: true,         nameField: 'categoryName' },
  'purchase-by-item':     {
    route: 'purchaseByItem', nameField: 'productName',
    groupFields: { Supplier: 'supplierName', Category: 'categoryName' },
    drill: { idField: 'productId', slug: 'purchase-by-item-sub' },
    countSubs: PURCHASE_ITEM_COUNTS, ratioSubs: PURCHASE_ITEM_RATIOS,
  },
  'payment-method':       { route: 'getPaymentMethodReport',  nameField: 'paymentMethodName', countSubs: ['transactionCount'], countDrill: { idField: 'paymentId', slug: 'payment-method-sub', param: 'paymentId', nameParam: 'paymentMethodName' } },
  'prepared-time-summary': { route: 'preparedTimeSummaryReport', nameField: 'serviceName', countSubs: ['countedInvoices', 'unCountedInvoices'] },
  'product-prepared-time-summary': { route: 'productPreparedTimeSummaryReport', nameField: 'prodName', countSubs: ['qty'] },
  'purchase-by-item-sub': { route: 'purchaseByItem',             nameField: 'supplierName', countSubs: PURCHASE_ITEM_COUNTS, ratioSubs: PURCHASE_ITEM_RATIOS },
};
