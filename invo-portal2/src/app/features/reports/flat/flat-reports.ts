/**
 * Reports that are one plain table — a list of rows with a Total row — share one body (`FlatReportComponent`). Each is the
 * legacy page's data call and columns, checked against InvoCloudBack's `routes/v1/app/reports/reports.ts` and the repo functions.
 * Adding a report of this shape = one entry here + one catalog entry (+ its column labels in `REPORTS.FLAT.COLUMNS`).
 */
export type FlatCellType =
  | 'text' | 'number' | 'currency' | 'date' | 'daydate' | 'datetime'
  /** a profit amount — green when positive, red when negative */
  | 'profit'
  /** a profit percentage as a coloured badge */
  | 'profitPct'
  /** low / out-of-stock style status badge */
  | 'status'
  /** a transfer's direction: "Transfer Out" red, "Transfer In" green */
  | 'direction'
  /** stock on hand, coloured by its reorder point / level (red out or below the point, amber below the level) */
  | 'stock'
  /** a purchase order's conversion into bills: not / partially / fully converted */
  | 'conversion'
  /** a time span the backend answers as an interval object ({ hours, minutes, seconds, days }) */
  | 'interval'
  /** a duration in seconds, shown as "Xh Ym" */
  | 'seconds'
  /** how long ago something happened, in seconds, as a red pill with a clock: hours under two days, then days and hours */
  | 'age'
  /** a status word from the backend as a coloured pill (on time / late / absent …) */
  | 'tag'
  /** a rank (1, 2, 3 …) as a pill: #1 green, #2 and #3 teal, the rest grey */
  | 'rank'
  /** the in / out photos of a row's shifts: icons that show the picture when hovered */
  | 'shots'
  /** a percentage with one decimal ("92.5%") */
  | 'pct'
  /** a score, bold */
  | 'score'
  /** a time of day (HH:mm) from a date-time value */
  | 'time'
  /** a tick for "yes", a dash for "no" */
  | 'yesno'
  /** a suggested order quantity as an amber badge */
  | 'orderQty'
  /** the expected stock-out date as a badge: red within a week, amber within two, blue within a month */
  | 'stockout'
  /** an expiry date as a badge (red expired, amber soon, green later) with the days left */
  | 'expiry';

export interface FlatColumn {
  key: string;
  type?: FlatCellType;
  /** Right-aligned (numbers, amounts). */
  end?: boolean;
  /** The amount is a percentage when this record field says `percentage` (a surcharge can be either). */
  pctKey?: string;
  /** A zero shows as a dash (a count that is usually none: photos). */
  dashZero?: boolean;
  /** The value links to this report's detail: a product opens its Product Movement (when the row carries `productId`). */
  link?: 'product';
  /** The number opens another report for this row's customer, with the same period and branches. */
  drill?: { slug: string; idKey: string; /** URL param that carries the id (default `customers`). */ param?: string; /** value used when the row has no id */ fallback?: string };
  /** The cell opens this document (`journalLink(type, rec[idKey])`) when the row carries its id. */
  doc?: { type?: string; /** read the document type from this row field instead */ typeKey?: string; idKey: string };
  /** A second record field shown as a small badge after the value (a product's barcode). */
  badge?: string;
  /** Red text (quantities / values that are losses). */
  danger?: boolean;
  /** The Total row shows `total[key]` for this column. */
  total?: boolean;
  /** Colours the whole column (solid header, tinted cells) so related figures read as a block (the legacy cashier report). */
  tone?: 'amber' | 'orange' | 'blue' | 'green' | 'red' | 'purple' | 'teal';
  /** i18n key of a short explanation shown as an ⓘ beside the header (a tooltip). */
  hint?: string;
  /** i18n key of the column's header; default `REPORTS.FLAT.COLUMNS.<key>`. */
  label?: string;
}

export interface FlatReportConfig {
  /** `POST accounts/reports/{route}` */
  route: string;
  columns: FlatColumn[];
  /** The backend pages the rows (`page` / `limit`, answers `count` / `pageCount`). */
  paged: boolean;
  /** Reshapes each record before it is drawn (reads values out of a nested response). */
  map?: (rec: Record<string, any>) => Record<string, any>;
  /** Each record carries its rows in this list (`details`): they are spread into rows that keep the record's own fields (date, cashier). */
  expand?: string;
  /** The record field is an object (`{ Cash: 10, Card: 5 }`): each of its keys becomes a currency column, in place of this column. */
  spread?: string;
  /** Keys of the answer's `summary` object shown as figures above the table (`REPORTS.FLAT.SUMMARY.<key>`). */
  summary?: { key: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'orange' }[];
  /** Figure tiles above the table: the sum of a column over the rows on the page, or the number of records. */
  kpis?: { key: string; tone: 'blue' | 'orange' | 'green' | 'teal' | 'purple' | 'amber' | 'red'; /** a percentage averaged over the rows, weighted by this column (Attendance, weighted by scheduled days) */ weightBy?: string; /** i18n key of the tile's title when the column's own title doesn't fit */ label?: string }[];
  /**
   * Rows come in groups (`[{ [groupKey]: …, [listKey]: [rows] }]`): the group name sits on the group's first row, and each group
   * ends with a subtotal of the `total` columns (Inventory Transfer, by reason).
   */
  grouped?: { groupKey: string; listKey: string; groupColumn: string };
  /**
   * The backend groups (or only orders) the rows by the value of a filter — `filter[filterKey]` picks the option: either it
   * answers groups (`groupKey` / `listKey`, as `grouped`) or it only sorts the rows, and rows with the same `flatField` form a group.
   */
  groupedBy?: { filterKey: string; /** option used while the filter has no value */ default?: string; options: Record<string, { groupColumn: string; groupKey?: string; listKey?: string; flatField?: string }> };
  /** Flat rows ordered by `field`; a run of the same value is a group — its name on the first row, a subtotal after (from `subtotal` record fields, or summed). */
  groupBy?: { field: string; subtotal?: Record<string, string>; /** leave out each group's subtotal row */ noSubtotal?: boolean; /** a second field merged inside each group (Short / Over: the cashier within a date) */ then?: string };
}

const PRODUCT = { key: 'productName', badge: 'barcode', link: 'product' } as const;

export const FLAT_REPORTS: Record<string, FlatReportConfig> = {
  'customer-order-history': {
    route: 'customerOrderHistoryReport', paged: true,
    columns: [
      { key: 'customerName' }, { key: 'contact' }, { key: 'invoiceNumber', doc: { type: 'Invoice', idKey: 'invoiceId' } },
      { key: 'invoiceDate', type: 'date' }, { key: 'total', type: 'currency', end: true },
    ],
  },
  'sales-by-customers-summary': {
    route: 'salesByCustomer', paged: true,
    columns: [
      { key: 'customerName' }, { key: 'numberOfInvoices', type: 'number', end: true, total: true, drill: { slug: 'customer-order-history', idKey: 'customerId' } },
      { key: 'invoiceSales', type: 'currency', end: true, total: true },
      { key: 'numberOfCreditNotes', type: 'number', end: true, total: true, drill: { slug: 'credit-notes', idKey: 'customerId' } },
      { key: 'creditNoteSales', type: 'currency', end: true, total: true }, { key: 'totalSales', type: 'currency', end: true, total: true },
    ],
  },
  'customer-balance-summary': {
    route: 'customerBalance', paged: true,
    columns: [
      { key: 'name', label: 'REPORTS.FLAT.COLUMNS.customerName' }, { key: 'invoiceBalance', type: 'currency', end: true },
      { key: 'availableCredits', type: 'currency', end: true }, { key: 'balance', type: 'profit', end: true },
    ],
  },
  'payment-received': {
    route: 'paymentReceived', paged: true,
    groupedBy: {
      filterKey: 'groupBy',
      options: {
        Customer: { groupKey: 'customerName', listKey: 'paymentList', groupColumn: 'customerName' },
        'Payment Method': { groupKey: 'paymentMode', listKey: 'paymentList', groupColumn: 'paymentMode' },
      },
    },
    columns: [
      { key: 'paymentDate', type: 'date' }, { key: 'referenceNumber' }, { key: 'customerName' }, { key: 'paymentMode' }, { key: 'depositTo' },
      { key: 'invoiceNumber', doc: { type: 'Invoice', idKey: 'invoiceId' } }, { key: 'note' }, { key: 'amount', type: 'currency', end: true, total: true },
    ],
  },
  'credit-notes': {
    route: 'creditNoteReport', paged: true,
    columns: [
      { key: 'creditNoteDate', type: 'date' }, { key: 'creditNoteNumber', doc: { type: 'CreditNote', idKey: 'id' } }, { key: 'customerName' },
      { key: 'creditNoteAmount', type: 'currency', end: true }, { key: 'invoiceNumber', doc: { type: 'Invoice', idKey: 'invoiceId' } },
      { key: 'balanceAmount', type: 'currency', end: true },
    ],
  },
  'refunds': {
    route: 'refundReport', paged: true,
    groupedBy: {
      filterKey: 'groupBy',
      options: { Customer: { groupColumn: 'customerName', flatField: 'customerName' }, 'Payment Method': { groupColumn: 'mode', flatField: 'mode' } },
    },
    columns: [
      { key: 'refundDate', type: 'date' }, { key: 'refrenceNumber', label: 'REPORTS.FLAT.COLUMNS.referenceNumber' }, { key: 'customerName' }, { key: 'mode' },
      { key: 'creditNoteNumber', doc: { type: 'CreditNote', idKey: 'creditNoteId' } }, { key: 'note' }, { key: 'amount', type: 'currency', end: true, total: true },
    ],
  },
  'customer-wise-item-sales': {
    route: 'customerWiseItemSalesReport', paged: true,
    groupedBy: { filterKey: 'groupBy', default: 'Customer', options: { Customer: { groupColumn: 'customerName', flatField: 'customerName' } } },
    groupBy: { field: 'customerName', subtotal: { qty: 'totalQtyPerCustomer', sales: 'totalSalesPerCustomer' } },
    columns: [
      { key: 'customerName' }, { key: 'productName', label: 'REPORTS.FLAT.COLUMNS.itemDescription' }, { key: 'qty', type: 'number', end: true, total: true },
      { key: 'unitPrice', type: 'currency', end: true }, { key: 'sales', type: 'currency', end: true, total: true },
    ],
  },
  'customer-wise-discount': {
    route: 'customerWiseDiscountReport', paged: true,
    groupedBy: { filterKey: 'groupBy', default: 'Customer', options: { Customer: { groupColumn: 'customerName', flatField: 'customerName' } } },
    groupBy: { field: 'customerName' },
    columns: [{ key: 'customerName' }, { key: 'discountName' }, { key: 'discountTotal', type: 'currency', end: true, total: true }],
  },
  'purchase-by-supplier': {
    route: 'purchaseBySupplier', paged: true,
    // summary[0][<Total label>] = { <count label>, <amount label>, 'Supplier Credit Amount', total } - the labels follow the chosen mode
    map: r => {
      const t = Object.values(r['summary']?.[0] ?? {})[0] as Record<string, any> ?? {};
      const v = Object.values(t);
      return { ...r, docCount: v[0] ?? 0, docAmount: v[1] ?? 0, creditAmount: t['Supplier Credit Amount'] ?? v[2] ?? 0, total: t['total'] ?? 0 };
    },
    columns: [
      { key: 'supplierName' }, { key: 'docCount', type: 'number', end: true, total: true }, { key: 'docAmount', type: 'currency', end: true, total: true },
      { key: 'creditAmount', type: 'currency', end: true, total: true }, { key: 'total', type: 'currency', end: true, total: true },
    ],
  },
  'supplier-balances': {
    route: 'supplierBalances', paged: true,
    columns: [
      { key: 'name', label: 'REPORTS.FLAT.COLUMNS.supplierName' }, { key: 'billingBalance', type: 'currency', end: true, total: true },
      { key: 'availableCredits', type: 'currency', end: true, total: true }, { key: 'balance', type: 'currency', end: true, total: true },
    ],
  },
  'payment-made': {
    route: 'paymentMade', paged: true,
    groupedBy: {
      filterKey: 'groupBy',
      options: {
        Supplier: { groupKey: 'supplierName', listKey: 'paymentList', groupColumn: 'supplierName' },
        'Payment Method': { groupColumn: 'paymentMode', flatField: 'paymentMode' },
      },
    },
    columns: [
      { key: 'paymentDate', type: 'date' }, { key: 'referenceNumber' }, { key: 'supplierName' }, { key: 'paymentMode' }, { key: 'depositTo' },
      { key: 'billingNumber', doc: { type: 'Billing', idKey: 'billingId' } }, { key: 'amount', type: 'currency', end: true, total: true },
    ],
  },
  'supplier-credits': {
    route: 'supplierCreditReport', paged: true,
    // grouping by supplier only orders the rows; a run of the same supplier is a group
    groupedBy: { filterKey: 'groupBy', options: { Supplier: { groupColumn: 'supplierName', flatField: 'supplierName' } } },
    columns: [
      { key: 'supplierCreditDate', type: 'date' }, { key: 'supplierCreditNumber', doc: { type: 'SupplierCredit', idKey: 'id' } }, { key: 'supplierName' },
      { key: 'supplierCreditAmount', type: 'currency', end: true, total: true }, { key: 'billingNumber', doc: { type: 'Billing', idKey: 'billingId' } },
      { key: 'balanceAmount', type: 'currency', end: true, total: true },
    ],
  },
  'supplier-refunds': {
    route: 'supplierRefundReport', paged: true,
    columns: [
      { key: 'refundDate', type: 'date' }, { key: 'referenceNumber' }, { key: 'supplierName' }, { key: 'mode' },
      { key: 'supplierCreditNumber', doc: { type: 'SupplierCredit', idKey: 'supplierCreditId' } }, { key: 'note' }, { key: 'amount', type: 'currency', end: true, total: true },
    ],
  },
  'supplier-change-price': {
    route: 'supplierChangePriceReport', paged: true,
    columns: [
      { key: 'supplierName' }, { key: 'productName', link: 'product' }, { key: 'oldPrice', type: 'currency', end: true }, { key: 'newPrice', type: 'currency', end: true },
      { key: 'priceChange', type: 'profitPct', end: true }, { key: 'effectiveDate', type: 'date' },
    ],
  },
  'attendance': {
    route: 'getAttendanceReport', paged: true,
    // attendance = [{ clockedIn, clockedOut, ... }] — up to three punches a day, read as in/out pairs
    map: r => {
      const a: any[] = Array.isArray(r['attendance']) ? r['attendance'] : [];
      return { ...r, in1: a[0]?.clockedIn, out1: a[0]?.clockedOut, in2: a[1]?.clockedIn, out2: a[1]?.clockedOut, in3: a[2]?.clockedIn, out3: a[2]?.clockedOut };
    },
    columns: [
      { key: 'date', type: 'date' }, { key: 'employeeName', drill: { slug: 'attendance-detail', idKey: 'employeeId', param: 'employee' } }, { key: 'branchName' },
      { key: 'in1', tone: 'green', type: 'datetime' }, { key: 'out1', tone: 'orange', type: 'datetime' }, { key: 'in2', tone: 'green', type: 'datetime' }, { key: 'out2', tone: 'orange', type: 'datetime' },
      { key: 'in3', tone: 'green', type: 'datetime' }, { key: 'out3', tone: 'orange', type: 'datetime' }, { key: 'totalHours', tone: 'blue', end: true },
    ],
  },
  'sales-by-employee': {
    route: 'salesByEmployeeReport', paged: true,
    columns: [
      { key: 'employeeName' }, { key: 'invoiceProdQty', tone: 'blue', type: 'number', end: true, total: true }, { key: 'invoiceSales', tone: 'blue', type: 'currency', end: true, total: true },
      { key: 'creditNoteProdQty', tone: 'orange', type: 'number', end: true, total: true }, { key: 'creditNoteSales', tone: 'orange', type: 'currency', end: true, total: true },
      { key: 'totalSalesQty', tone: 'green', type: 'number', end: true, total: true }, { key: 'totalSales', tone: 'green', type: 'currency', end: true, total: true },
    ],
  },
  'sales-by-employee-vs-products': {
    route: 'salesByProductVsEmployee', paged: true,
    groupBy: {
      field: 'employeeName',
      subtotal: {
        invoiceProdQty: 'invoiceProdQtyPerEmployee', invoiceSales: 'invoiceSalesPerEmployee', creditNoteProdQty: 'creditNoteProdQtyPerEmployee',
        creditNoteSales: 'creditNoteSalesPerEmployee', totalSalesQty: 'totalSalesQtyPerEmployee', totalSales: 'totalSalesPerEmployee',
      },
    },
    columns: [
      { key: 'employeeName' }, { key: 'productName', link: 'product' }, { key: 'invoiceProdQty', tone: 'blue', type: 'number', end: true, total: true }, { key: 'invoiceSales', tone: 'blue', type: 'currency', end: true, total: true },
      { key: 'creditNoteProdQty', tone: 'orange', type: 'number', end: true, total: true }, { key: 'creditNoteSales', tone: 'orange', type: 'currency', end: true, total: true },
      { key: 'totalSalesQty', tone: 'green', type: 'number', end: true, total: true }, { key: 'totalSales', tone: 'green', type: 'currency', end: true, total: true },
    ],
  },
  'vat-audit': {
    route: 'vatDetailsReport', paged: true,
    columns: [
      { key: 'date', type: 'date' }, { key: 'type' }, { key: 'referenceNumber' }, { key: 'ContactName' }, { key: 'name' },
      { key: 'taxableAmount', type: 'currency', end: true, total: true }, { key: 'vat', type: 'currency', end: true, total: true },
      { key: 'none_taxableAmount', type: 'currency', end: true, total: true }, { key: 'totalAmount', type: 'currency', end: true, total: true },
    ],
  },
  'discount-report': {
    route: 'salesDiscountReport', paged: false,
    // the margin comes as a fraction, the discount share already as a percentage
    map: r => ({ ...r, grossMarginPct: Number(r['GrossMarginPercentage'] ?? 0) * 100 }),
    columns: [
      { key: 'DiscountName', drill: { slug: 'sales-by-discount', idKey: 'discountId', param: 'discount', fallback: 'others' } },
      { key: 'salesCount', type: 'number', end: true, total: true }, { key: 'salesAmount', type: 'currency', end: true, total: true },
      { key: 'netDiscountPercentage', type: 'number', end: true }, { key: 'discountTotal', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'costs', type: 'currency', end: true, total: true },
      { key: 'grossMarginPct', type: 'profitPct', end: true }, { key: 'grossProfit', type: 'profit', end: true, total: true },
    ],
  },
  'sales-by-discount': {
    route: 'salesByDiscountId', paged: true,
    columns: [
      { key: 'code' }, { key: 'type' }, { key: 'salesAmount', type: 'currency', end: true, total: true }, { key: 'discountTotal', type: 'currency', end: true, total: true },
      { key: 'taxTotal', type: 'currency', end: true, total: true }, { key: 'total', type: 'currency', end: true, total: true },
    ],
  },
  'product-wise-vat': {
    route: 'productWiseVatReport', paged: true,
    columns: [
      { key: 'productName', link: 'product' }, { key: 'taxName' },
      { key: 'salesAmountAfterDiscount', type: 'currency', end: true, total: true }, { key: 'salesTax', type: 'currency', end: true, total: true },
      { key: 'purchaseAmount', type: 'currency', end: true, total: true }, { key: 'purchaseTax', type: 'currency', end: true, total: true },
      { key: 'netVat', type: 'currency', end: true, total: true },
    ],
  },
  'sales-by-tables': {
    route: 'getSalesByTables', paged: true,
    columns: [
      { key: 'tableName' }, { key: 'invoiceSales', type: 'currency', end: true, total: true }, { key: 'creditNoteSales', type: 'currency', end: true, total: true },
      { key: 'totalSales', type: 'currency', end: true, total: true }, { key: 'numberOfInvoices', type: 'number', end: true, total: true },
      { key: 'salesOrderAvg', type: 'currency', end: true, total: true }, { key: 'numberOfguests', type: 'number', end: true, total: true },
      { key: 'salesGuestAvg', type: 'currency', end: true, total: true },
    ],
  },
  'sales-by-table-groups': {
    route: 'getSalesByTableGroups', paged: true,
    columns: [
      { key: 'tableGroupName' }, { key: 'invoiceSales', type: 'currency', end: true, total: true }, { key: 'creditNoteSales', type: 'currency', end: true, total: true },
      { key: 'totalSales', type: 'currency', end: true, total: true }, { key: 'numberOfInvoices', type: 'number', end: true, total: true },
      { key: 'salesAvg', type: 'currency', end: true, total: true },
    ],
  },
  'table-usage-report': {
    route: 'tableUsage', paged: true,
    grouped: { groupKey: 'name', listKey: 'invoices', groupColumn: 'name' },
    columns: [
      { key: 'name', label: 'REPORTS.FLAT.COLUMNS.tableName' }, { key: 'invoiceNumber', doc: { type: 'Invoice', idKey: 'invoiceId' } },
      { key: 'creationTime', type: 'datetime' }, { key: 'settleTime', type: 'datetime' }, { key: 'usage', type: 'interval' },
      { key: 'total', type: 'currency', end: true, total: true },
    ],
  },
  'table-usage-summary-report': {
    route: 'tableUsageSummary', paged: true,
    columns: [
      { key: 'name', label: 'REPORTS.FLAT.COLUMNS.tableName' }, { key: 'invoiceCount', type: 'number', end: true },
      { key: 'usage', type: 'interval', end: true }, { key: 'avgUsage', type: 'interval', end: true },
    ],
  },
  'cashier-summary-report': {
    route: 'getCashierReport', paged: true,
    columns: [
      { key: 'cashierName' }, { key: 'cashierIn', type: 'datetime' }, { key: 'cashierOut', type: 'datetime' },
      { key: 'transactions', tone: 'amber', type: 'number', end: true, total: true }, { key: 'startAmount', tone: 'blue', type: 'currency', end: true, total: true },
      { key: 'totalPayment', tone: 'green', type: 'currency', end: true, total: true }, { key: 'totalRefunds', tone: 'green', type: 'currency', end: true, total: true },
      { key: 'expected', tone: 'teal', type: 'currency', end: true, total: true }, { key: 'endAmount', tone: 'teal', type: 'currency', end: true, total: true },
      { key: 'variance', tone: 'teal', type: 'profit', end: true, total: true },
    ],
  },
  'short-over-report': {
    route: 'shortOver', paged: true,
    // records are { date, cashierName, details: [{ tender, countAmount, expected, shortOver }] }
    expand: 'details',
    groupBy: { field: 'date', noSubtotal: true, then: 'cashierName' },
    columns: [
      { key: 'date', type: 'date' }, { key: 'cashierName' }, { key: 'tender', tone: 'amber' }, { key: 'countAmount', tone: 'blue', type: 'currency', end: true, total: true },
      { key: 'expected', tone: 'blue', type: 'currency', end: true, total: true }, { key: 'shortOver', tone: 'teal', type: 'profit', end: true, total: true },
    ],
  },
  'driver-report': {
    route: 'getDriverReport', paged: true,
    columns: [
      { key: 'employeeName' }, { key: 'invoiceQty', tone: 'blue', type: 'number', end: true, total: true }, { key: 'invoiceTotal', tone: 'blue', type: 'currency', end: true, total: true },
      { key: 'avgDeliveryTime', tone: 'teal', type: 'seconds', end: true },
    ],
  },
  'driver-details-report': {
    route: 'getDriverDetailsReport', paged: true,
    columns: [
      { key: 'employeeName' }, { key: 'invoiceNumber', doc: { type: 'Invoice', idKey: 'invoiceId' } }, { key: 'invoiceTotal', tone: 'blue', type: 'currency', end: true, total: true },
      { key: 'departureTime', tone: 'teal', type: 'datetime' }, { key: 'arrivalTime', tone: 'teal', type: 'datetime' }, { key: 'deliveryTime', tone: 'teal', type: 'seconds', end: true },
    ],
  },
  'customer-table-by-employee': {
    route: 'customerTableByEmployee', paged: true,
    columns: [
      { key: 'employeeName' }, { key: 'numberOfTables', type: 'number', end: true, total: true }, { key: 'numberOfguests', type: 'number', end: true, total: true },
      { key: 'guestTableAvg', type: 'number', end: true, total: true },
    ],
  },
  'missing-punches': {
    route: '/attendance/missingPunches', paged: true,
    map: r => ({ ...r, age: r['ageMs'] != null ? Number(r['ageMs']) / 1000 : null }),
    columns: [
      { key: 'employeeName', drill: { slug: 'attendance-detail', idKey: 'employeeId', param: 'employee' } }, { key: 'branchName' }, { key: 'clockedIn', tone: 'green', type: 'datetime' }, { key: 'clockedOut', tone: 'orange', type: 'datetime' },
      { key: 'adjClockedIn', tone: 'blue', type: 'datetime' }, { key: 'adjClockedOut', tone: 'blue', type: 'datetime' }, { key: 'issue', type: 'tag' }, { key: 'age', type: 'age', end: true },
    ],
  },
  'hours-summary': {
    route: '/attendance/hoursSummary', paged: true,
    kpis: [{ key: 'totalDaysWorked', tone: 'teal' }, { key: 'regularHours', tone: 'blue' }, { key: 'overtimeHours', tone: 'orange' }, { key: 'grossPayBHD', tone: 'green' }, { key: '#records', tone: 'purple' }],
    columns: [
      { key: 'employeeName', drill: { slug: 'attendance-detail', idKey: 'employeeId', param: 'employee' } }, { key: 'totalDaysWorked', type: 'number', end: true }, { key: 'regularHours', tone: 'blue', type: 'number', end: true, total: true },
      { key: 'overtimeHours', tone: 'orange', type: 'number', end: true, total: true }, { key: 'totalBreakDeduction', type: 'number', end: true }, { key: 'peakWeekHours', type: 'number', end: true },
      { key: 'hourlyRate', type: 'currency', end: true }, { key: 'grossPayBHD', tone: 'green', type: 'currency', end: true, total: true },
    ],
  },
  'overtime': {
    route: '/attendance/overtime', paged: true,
    kpis: [{ key: 'regularHours', tone: 'blue' }, { key: 'overtimeHours', tone: 'orange' }, { key: 'otPayBHD', tone: 'green' }, { key: '#records', tone: 'purple' }],
    columns: [
      { key: 'employeeName', drill: { slug: 'attendance-detail', idKey: 'employeeId', param: 'employee' } }, { key: 'regularHours', tone: 'blue', type: 'number', end: true }, { key: 'overtimeHours', tone: 'orange', type: 'number', end: true, total: true },
      { key: 'peakWeekHours', type: 'number', end: true }, { key: 'otPercentage', tone: 'orange', type: 'number', end: true }, { key: 'weeksOverLimit', type: 'number', end: true },
      { key: 'status', type: 'tag' }, { key: 'otPayBHD', tone: 'green', type: 'currency', end: true, total: true },
    ],
  },
  'late-and-early': {
    route: '/attendance/lateAndEarly', paged: true,
    kpis: [{ key: 'lateCount', tone: 'amber' }, { key: 'totalMinutesLate', tone: 'amber' }, { key: 'earlyOutCount', tone: 'orange' }, { key: 'totalMinutesEarly', tone: 'orange' }, { key: '#records', tone: 'purple' }],
    columns: [
      { key: 'employeeName', drill: { slug: 'attendance-detail', idKey: 'employeeId', param: 'employee' } }, { key: 'lateCount', tone: 'amber', type: 'number', end: true }, { key: 'totalMinutesLate', tone: 'amber', type: 'number', end: true },
      { key: 'avgMinutesLate', tone: 'amber', type: 'number', end: true }, { key: 'worstLateMinutes', tone: 'amber', type: 'number', end: true }, { key: 'earlyOutCount', tone: 'orange', type: 'number', end: true },
      { key: 'totalMinutesEarly', tone: 'orange', type: 'number', end: true },
    ],
  },
  'daily-sheet': {
    route: '/attendance/dailySheet', paged: true,
    // the legacy sheet's six figures (no "upcoming" / "unscheduled")
    summary: [{ key: 'totalScheduled', tone: 'blue' }, { key: 'present', tone: 'green' }, { key: 'late', tone: 'amber' }, { key: 'absent', tone: 'red' }, { key: 'onLeave', tone: 'purple' }, { key: 'clockedOut', tone: 'teal' }],
    // one scheduled-shift cell, a photo count and an "adjusted" flag, from the row's shifts
    map: r => {
      const shifts: any[] = Array.isArray(r['shifts']) ? r['shifts'] : [];
      return {
        ...r,
        shift: r['expectedStartLocal'] && r['expectedEndLocal'] ? `${r['expectedStartLocal']} – ${r['expectedEndLocal']}` : null,
        photos: shifts.reduce((n, s) => n + (s?.clockedInMediaUrl ? 1 : 0) + (s?.clockedOutMediaUrl ? 1 : 0), 0),
        adjusted: !!r['wasAdjusted'],
      };
    },
    columns: [
      { key: 'employeeName', drill: { slug: 'attendance-detail', idKey: 'employeeId', param: 'employee' } }, { key: 'shift' },
      { key: 'clockedIn', type: 'time' }, { key: 'clockedOut', type: 'time' }, { key: 'photos', type: 'shots' },
      { key: 'leaveTypeRaw', label: 'REPORTS.FLAT.COLUMNS.leaveType' }, { key: 'status', type: 'tag' }, { key: 'adjusted', type: 'yesno' },
    ],
  },
  'branch-comparison': {
    route: '/attendance/branchComparison', paged: false,
    kpis: [{ key: 'headcount', tone: 'blue' }, { key: 'attendancePct', tone: 'green', weightBy: 'scheduledDays', label: 'REPORTS.FLAT.KPI_ATTENDANCE_WEIGHTED' }, { key: 'overtimeHours', tone: 'orange' }, { key: '#records', tone: 'purple' }],
    columns: [
      { key: 'branchRank', type: 'rank' }, { key: 'branchName' }, { key: 'headcount', type: 'number', end: true }, { key: 'scheduledDays', type: 'number', end: true },
      { key: 'attendancePct', tone: 'green', type: 'number', end: true }, { key: 'absenceRatePct', tone: 'red', type: 'number', end: true },
      { key: 'overtimeHours', tone: 'orange', type: 'number', end: true }, { key: 'avgOTHoursPerEmployee', tone: 'orange', type: 'number', end: true },
    ],
  },
  'scorecard': {
    route: '/attendance/scorecard', paged: true,
    columns: [
      { key: 'employeeName', drill: { slug: 'attendance-detail', idKey: 'employeeId', param: 'employee' } },
      { key: 'scheduledDays', tone: 'blue', type: 'number', end: true }, { key: 'attendedDays', tone: 'blue', type: 'number', end: true },
      { key: 'missedPunches', tone: 'amber', type: 'number', end: true }, { key: 'unauthAbsenceDays', tone: 'red', type: 'number', end: true },
      { key: 'onTimePct', tone: 'green', type: 'pct', end: true }, { key: 'noUnauthAbsencePct', tone: 'green', type: 'pct', end: true },
      { key: 'compositeScore', tone: 'teal', type: 'score', end: true, hint: 'REPORTS.FLAT.HINT_SCORE' }, { key: 'rating', type: 'tag' },
    ],
  },
  'vat-transaction-details': {
    route: 'taxTransactionDetailsReport', paged: true,
    columns: [
      { key: 'tax' }, { key: 'documentType' }, { key: 'documentNumber' }, { key: 'date', type: 'date' }, { key: 'clientOrSupplier' }, { key: 'productOrDescription' },
      { key: 'totalExclusive', type: 'currency', end: true, total: true }, { key: 'taxAmount', type: 'currency', end: true, total: true }, { key: 'totalInclusive', type: 'currency', end: true, total: true },
    ],
  },
  'bill-of-entry-details-vat': {
    route: 'billOfEntryDetailsVatReport', paged: true,
    columns: [
      { key: 'date', type: 'date' }, { key: 'type' }, { key: 'referenceNumber' }, { key: 'name' },
      { key: 'taxableAmount', type: 'currency', end: true, total: true }, { key: 'vat', type: 'currency', end: true, total: true },
      { key: 'none_taxableAmount', type: 'currency', end: true, total: true }, { key: 'totalAmount', type: 'currency', end: true, total: true },
    ],
  },
  'daily-sales': {
    route: 'salesByPeriodReport', paged: false,
    columns: [
      { key: 'date', type: 'date' }, { key: 'productQty', type: 'number', end: true, total: true }, { key: 'grossSales', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'salesInclTax', type: 'currency', end: true, total: true },
    ],
  },
  'hourly-sales': {
    route: 'salesByPeriodReport', paged: false,
    columns: [
      { key: 'hour' }, { key: 'productQty', type: 'number', end: true, total: true }, { key: 'grossSales', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'salesInclTax', type: 'currency', end: true, total: true },
    ],
  },
  'weekday-sales': {
    route: 'salesByPeriodReport', paged: false,
    columns: [
      { key: 'day' }, { key: 'productQty', type: 'number', end: true, total: true }, { key: 'grossSales', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'salesInclTax', type: 'currency', end: true, total: true },
    ],
  },
  'weekly-sales': {
    route: 'salesByPeriodReport', paged: false,
    columns: [
      { key: 'week' }, { key: 'productQty', type: 'number', end: true, total: true }, { key: 'grossSales', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'salesInclTax', type: 'currency', end: true, total: true },
    ],
  },
  'monthly-sales': {
    route: 'salesByPeriodReport', paged: false,
    columns: [
      { key: 'month' }, { key: 'productQty', type: 'number', end: true, total: true }, { key: 'grossSales', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'salesInclTax', type: 'currency', end: true, total: true },
    ],
  },
  'quarterly-sales': {
    route: 'salesByPeriodReport', paged: false,
    columns: [
      { key: 'quarter' }, { key: 'productQty', type: 'number', end: true, total: true }, { key: 'grossSales', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'salesInclTax', type: 'currency', end: true, total: true },
    ],
  },
  'yearly-sales': {
    route: 'salesByPeriodReport', paged: false,
    columns: [
      { key: 'year' }, { key: 'productQty', type: 'number', end: true, total: true }, { key: 'grossSales', type: 'currency', end: true, total: true },
      { key: 'netSales', type: 'currency', end: true, total: true }, { key: 'salesInclTax', type: 'currency', end: true, total: true },
    ],
  },
  'transaction-discount': {
    route: 'transactionDiscountReports', paged: false,
    columns: [
      { key: 'code', doc: { typeKey: 'type', idKey: 'id' } }, { key: 'type', doc: { typeKey: 'type', idKey: 'id' } }, { key: 'sales', type: 'currency', end: true, total: true }, { key: 'discountTotal', type: 'currency', end: true, total: true },
      { key: 'taxTotal', type: 'currency', end: true, total: true }, { key: 'total', type: 'currency', end: true, total: true },
    ],
  },
  'void-transactions': {
    route: 'voidTransactionsReport', paged: true,
    columns: [
      { key: 'createdAt', type: 'date', label: 'REPORTS.FLAT.COLUMNS.date' }, { key: 'invoiceNumber', doc: { type: 'Invoice', idKey: 'invoiceId' } }, { key: 'productName' }, { key: 'employeeName' },
      { key: 'amount', type: 'currency', end: true, total: true }, { key: 'voidReason' },
    ],
  },
  'unsold-products': {
    route: 'unsoldProductReport', paged: true,
    columns: [
      { key: 'productName', link: 'product' }, { key: 'stock', type: 'number', end: true, total: true }, { key: 'unitCost', type: 'currency', end: true },
      { key: 'stockValue', type: 'currency', end: true, total: true }, { key: 'lastSaleDate', type: 'date' }, { key: 'daysUnSold', type: 'number', end: true }, { key: 'ageBucket', type: 'tag' },
    ],
  },
  'surcharge': {
    route: 'surchargeReport', paged: true,
    columns: [
      { key: 'chargeName' }, { key: 'invoiceCount', type: 'number', end: true, total: true }, { key: 'chargeAmount', type: 'currency', pctKey: 'chargeAmountType', end: true },
      { key: 'salesIncludingSurcharge', type: 'currency', end: true, total: true }, { key: 'totalSurcharge', type: 'currency', end: true, total: true },
      { key: 'averageSurcharge', type: 'currency', end: true, total: true },
    ],
  },
  'delivery-charge': {
    route: 'deliveryCharge', paged: true,
    columns: [
      { key: 'city' }, { key: 'Invoices', type: 'number', end: true, total: true }, { key: 'ChargedInvoices', type: 'number', end: true, total: true }, { key: 'Free', type: 'number', end: true, total: true },
      { key: 'DeliveryCharge', type: 'currency', end: true, total: true }, { key: 'Refunded', type: 'currency', end: true, total: true },
      { key: 'NetDeliveryCharges', type: 'currency', end: true, total: true }, { key: 'avgDeliveryCharge', type: 'currency', end: true, total: true },
    ],
  },
  'payouts': {
    route: 'payoutsReport', paged: false,
    columns: [
      { key: 'createdAt', type: 'datetime', label: 'REPORTS.FLAT.COLUMNS.date' }, { key: 'accountName' }, { key: 'cashierName' }, { key: 'PaymentName', label: 'REPORTS.FLAT.COLUMNS.paymentMethodName' },
      { key: 'amount', type: 'currency', end: true, total: true },
    ],
  },
  'daily-payment': {
    route: 'dailyPaymentReport', paged: false, spread: 'payments',
    columns: [
      { key: 'date', type: 'date' }, { key: 'dayOfWeek' }, { key: 'payments' }, { key: 'totalRefund', type: 'currency', end: true, total: true }, { key: 'total', type: 'currency', end: true, total: true },
    ],
  },
  'monthly-bld-breakdown': {
    route: 'monthlyBLDBreakdownReport', paged: false,
    columns: [
      { key: 'date', type: 'daydate' }, { key: 'grossSales', type: 'currency', end: true, total: true }, { key: 'discount', type: 'currency', end: true, total: true },
      { key: 'breakfastSales', type: 'currency', end: true, total: true }, { key: 'lunchSales', type: 'currency', end: true, total: true }, { key: 'dinnerSales', type: 'currency', end: true, total: true },
      { key: 'salesInclVat', type: 'currency', end: true, total: true }, { key: 'taxTotal', type: 'currency', end: true, total: true }, { key: 'salesExclVat', type: 'currency', end: true, total: true },
      { key: 'guests', type: 'number', end: true, total: true }, { key: 'avg', type: 'number', end: true },
    ],
  },
  'payment-method-sub': {
    route: 'paymentTransactions', paged: true,
    columns: [
      { key: 'paymentDate', type: 'datetime' }, { key: 'type', doc: { typeKey: 'type', idKey: 'referenceId' } }, { key: 'accountName' },
      { key: 'paymentTotal', type: 'currency', end: true, total: true }, { key: 'paymentEquivalent', type: 'currency', end: true, total: true },
    ],
  },
  'open-pending-po': {
    route: 'openPendingPOReport', paged: true,
    // the amounts come nested: summary[0]['Total'] = { 'Number Of Bills', 'PO Amount', 'Converted Bill Amount', 'Remaining To Convert' }
    map: r => {
      const t = r['summary']?.[0]?.['Total'] ?? {};
      return { ...r, billCount: t['Number Of Bills'] ?? r['billCount'] ?? 0, poAmount: t['PO Amount'] ?? 0, billedAmount: t['Converted Bill Amount'] ?? 0, remainingAmount: t['Remaining To Convert'] ?? 0 };
    },
    columns: [
      { key: 'createdAt', type: 'date' }, { key: 'purchaseNumber', doc: { type: 'PurchaseOrder', idKey: 'purchaseOrderId' } }, { key: 'supplierName' },
      { key: 'branchName' }, { key: 'conversionStatus', type: 'conversion' }, { key: 'billCount', type: 'number', end: true },
      { key: 'poAmount', type: 'currency', end: true, total: true }, { key: 'billedAmount', type: 'currency', end: true, total: true },
      { key: 'remainingAmount', type: 'currency', end: true, total: true },
    ],
  },
  'inventory-transfer': {
    route: 'inventoryTransferReport', paged: false,
    grouped: { groupKey: 'reason', listKey: 'transctions', groupColumn: 'reason' },
    columns: [
      { key: 'reason' }, { key: 'transferNumber' }, { key: 'type', type: 'direction' }, { key: 'branchesNames', label: 'REPORTS.FLAT.COLUMNS.branchName' },
      { key: 'transferedQty', type: 'number', end: true }, { key: 'createdDate', type: 'datetime' }, { key: 'confirmDatetime', type: 'datetime' },
      { key: 'note' }, { key: 'amount', type: 'currency', end: true, total: true },
    ],
  },
  'wastage-summary': {
    route: 'wastageSummaryReport', paged: true,
    columns: [
      { ...PRODUCT }, { key: 'wastageQty', type: 'number', end: true, danger: true, total: true },
      { key: 'wastageValue', type: 'currency', end: true, danger: true, total: true },
    ],
  },
  'detailed-wastage': {
    route: 'productWastageReport', paged: true,
    columns: [
      { ...PRODUCT }, { key: 'employeeName' }, { key: 'wastageQty', type: 'number', end: true, danger: true, total: true },
      { key: 'wastageValue', type: 'currency', end: true, danger: true, total: true }, { key: 'reason' },
    ],
  },
  'expired-products': {
    route: 'expiredProductsReport', paged: true,
    columns: [
      { ...PRODUCT }, { key: 'batch' }, { key: 'quantity', type: 'number', end: true, danger: true },
      { key: 'expirationDate', type: 'expiry' }, { key: 'branchName' },
    ],
  },
  'reorder-report': {
    route: 'reorderReport', paged: true,
    columns: [
      { ...PRODUCT }, { key: 'UOM', label: 'REPORTS.FLAT.COLUMNS.uom' }, { key: 'onHand', type: 'stock', end: true },
      { key: 'reorderLevel', type: 'number', end: true }, { key: 'reorderPoint', type: 'number', end: true },
      { key: 'suggestedOrderQty', type: 'orderQty', end: true }, { key: 'branchName' },
    ],
  },
  'reorder-alert': {
    route: 'reorderAlertReport', paged: true,
    columns: [
      { key: 'branchName' }, { key: 'locationName' }, { key: 'barcode', label: 'REPORTS.FLAT.COLUMNS.productBarcode' }, { key: 'productName', link: 'product' },
      { key: 'UOM', label: 'REPORTS.FLAT.COLUMNS.uom' },
      { key: 'parentBarcode' }, { key: 'parentName' }, { key: 'currentStock', type: 'stock', end: true },
      { key: 'reorderLevel', type: 'number', end: true }, { key: 'reorderPoint', type: 'number', end: true },
      { key: 'suggestedOrderQty', type: 'orderQty', end: true }, { key: 'stockStatus', type: 'status' },
      { key: 'weeklyUsage', type: 'number', end: true }, { key: 'weeklySales', type: 'number', end: true },
      { key: 'expectedStockoutDate', type: 'stockout' }, { key: 'lastSupplierName' }, { key: 'lastPurchaseDate', type: 'date' },
      { key: 'lastQty', type: 'number', end: true },
    ],
  },
  'sales-vs-inventory-usage': {
    route: 'salesVsInventoryUsageReport', paged: true,
    columns: [
      { key: 'date', type: 'date' }, { key: 'salesWithDiscount', type: 'currency', end: true, total: true },
      { key: 'usages', type: 'currency', end: true, total: true }, { key: 'profitAmount', type: 'profit', end: true, total: true },
      { key: 'profitPercentage', type: 'profitPct', end: true, total: true },
    ],
  },
  'product-sales-vs-inventory-usage': {
    route: 'productSalesVsInventoryUsageReport', paged: true,
    columns: [
      { ...PRODUCT }, { key: 'qty', type: 'number', end: true, total: true, label: 'REPORTS.FLAT.COLUMNS.quantity' },
      { key: 'sales', type: 'currency', end: true, total: true }, { key: 'usages', type: 'currency', end: true, total: true },
      { key: 'profitAmount', type: 'profit', end: true, total: true }, { key: 'profitPercentage', type: 'profitPct', end: true, total: true },
    ],
  },
};
