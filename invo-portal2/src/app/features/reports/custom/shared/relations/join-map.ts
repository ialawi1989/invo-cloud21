/**
 * Join constants for custom reports.
 *
 * GET /getDataSource returns each table's `refs[]` in one of two shapes, and the
 * join builder (`buildJoinFor` in the report-builder component) handles both:
 *
 *  1. **Column-shaped (legacy):** `{ name: <relatedTable>, source: <fkColumn>,
 *     target: <pkColumn> }`. The entry carries both join columns directly, e.g.
 *     `{ name: "CustomerView", source: "customerId", target: "id" }` →
 *     `InvoiceView.customerId = CustomerView.id`.
 *
 *  2. **Table-shaped:** `{ source: <table>, target: <table>, name: <label> }`.
 *     Here `source`/`target` are TABLE names and carry NO column info, e.g.
 *     `{ source: "Products", target: "BranchProducts", name: "Branch Products" }`.
 *     The FK column is recovered from `FK_COLUMN_BY_TARGET` below.
 *
 * For shape 2, the FK column is never in the ref — so emitting it verbatim
 * produces `ON "Products"."Products" = "BranchProducts"."BranchProducts"`, which
 * fails. `FK_COLUMN_BY_TARGET` maps a referenced (PK-side) table to the FK
 * column that points at it on the child table.
 */

/** Table the backend auto-joins for the tenant filter. The backend silently
 *  drops any Branches join we send for branch-scoped base tables, so the
 *  builder must not offer or emit one (see getRelatedTables / toggleJoin). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- backend table name, not a local variable
export const BRANCH_TABLE = 'Branches';

/**
 * Map: **referenced (PK-side) table → the FK column that points at it** (the FK
 * column lives on the child/owning table, referencing `<target>.id`). Used only
 * for table-shaped refs that don't carry column names. Keep in sync with backend
 * additions — adding a new joinable table needs one line here.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- backend table names as keys
export const FK_COLUMN_BY_TARGET: Record<string, string> = {
  CustomerView:          'customerId',
  Customers:             'customerId',
  Branches:              'branchId',
  Employees:             'employeeId',
  Tables:                'tableId',
  Services:              'serviceId',
  Terminals:             'terminalId',
  Discounts:             'discountId',
  Suppliers:             'supplierId',
  Products:              'productId',
  Taxes:                 'taxId',
  Accounts:              'accountId',
  Options:               'optionId',
  PaymentMethods:        'paymentMethodId',
  CashiersView:          'cashierId',
  BranchProducts:        'branchProductId',
  ProductBatches:        'productBatchId',

  // document refs — child line tables point at the parent header
  InvoiceView:           'invoiceId',
  InvoicePaymentsView:   'invoicePaymentId',
  EstimatesView:         'estimateId',
  CreditNotesView:       'creditNoteId',
  CreditNoteRefundsView: 'creditNoteRefundId',
  InvoiceLinesView:      'invoiceLineId',
  EstimateLinesView:     'estimateLineId',
  Billings:              'billingId',
  BillingPayments:       'billingPaymentId',
  PurchaseOrders:        'purchaseOrderId',
  // Sales/Bill line tables reference their header via a generic `documentId`
  // column (verified in getDataSource), NOT a salesId/billId column.
  SalesView:             'documentId',
  BillsView:             'documentId',

  // NOTE — target-keyed limitation: a few targets are reachable by more than
  // one FK column and CANNOT all be expressed here. The column-shaped ref path
  // handles them correctly today; this map is only the table-shaped fallback:
  //   - Accounts: also reached via `payableAccountId` (BillsView), not just `accountId`.
  //   - Employees: also reached via `salesEmployeeId` (SalesLinesView), not just `employeeId`.
};

/** FK column that references `<targetTable>.id`, or null when unmapped. */
export function fkColumnForTarget(targetTable: string): string | null {
  return FK_COLUMN_BY_TARGET[targetTable] ?? null;
}

/**
 * Tables that can only be joined **transitively**, through a required
 * intermediate table. Map: `table → the bridge table it hangs off`. When the
 * user joins such a table and the bridge isn't already present, the builder
 * injects the bridge join first (recursively), e.g. on a Products base:
 *   Products → BranchProducts → ProductBatches
 * The dependent's own join still attaches to the bridge (sid = bridge).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- backend table names as keys
export const JOIN_BRIDGE: Record<string, string> = {
  ProductBatches: 'BranchProducts',
};

/** The intermediate table required to reach `tid`, or null when it joins directly. */
export function bridgeTableFor(tid: string): string | null {
  return JOIN_BRIDGE[tid] ?? null;
}
