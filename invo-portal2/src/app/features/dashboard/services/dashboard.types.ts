// ────────────────────────────────────────────────────────────────────
// Dashboard — wire types for the legacy `dashboard/*` + `accounts/*`
// endpoints. Field names mirror the server payloads exactly; anything
// renamed for readability is mapped in the service, not here.
// ────────────────────────────────────────────────────────────────────

/** Every widget takes the same scope: a date window and a branch. */
export interface DashboardScope {
  from: string;              // 'YYYY-MM-DD'
  to: string;                // 'YYYY-MM-DD'
  /** `null` = all branches. */
  branchId: string | null;
}

// ─── business summary ───────────────────────────────────────────────
export interface BranchSalesRow {
  branchId: string;
  branchName: string;
  numberOfInvoices: number;
  sales: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  totalReturn: number;
  netSales: number;
  /** Derived client-side: this branch's share of total sales. */
  share: number;
}

// ─── summary blocks ─────────────────────────────────────────────────
export interface AccountSummaryBlock {
  balance: number;
  /** Six-month trail used for the sparkline. */
  trail: number[];
}

export interface DashboardSummary {
  costOfGoodsSold: AccountSummaryBlock;
  payable: AccountSummaryBlock;
  receivable: AccountSummaryBlock;
  netProfit: number;
}

// ─── payments flow ──────────────────────────────────────────────────
export interface PaymentsFlowPoint {
  /** Bucket label, 'MMM YYYY'. */
  label: string;
  cash: number;
  bank: number;
}

export interface PaymentsFlow {
  openingBalance: number;
  incoming: number;
  outgoing: number;
  closingBalance: number;
  points: PaymentsFlowPoint[];
}

// ─── income vs expense ──────────────────────────────────────────────
export interface IncomeExpensePoint {
  label: string;             // 'MMM YYYY'
  income: number;
  expense: number;
}

export interface IncomeExpense {
  totalIncome: number;
  totalExpense: number;
  net: number;
  points: IncomeExpensePoint[];
}

// ─── simple label/value series (most chart widgets) ─────────────────
/**
 * The shape every ranked/charted widget reduces to. Keeping one type here
 * rather than a dozen near-identical ones is what lets a single chart and a
 * single ranked-table component serve them all.
 */
export interface LabelValue {
  label: string;
  value: number;
  /** Secondary metric, where the widget has one (e.g. invoice count). */
  secondary?: number;
  /** Share of the series total, 0–100. Filled in by the service. */
  share?: number;
}

// ─── inventory widgets ──────────────────────────────────────────────
export interface LowStockRow {
  name: string;
  type: string;
  branchName: string;
  onHand: number;
}

export interface ExpiringBatchRow {
  productName: string;
  batch: string;
  prodDate: string;
  expireDate: string;
  onHand: number;
  /** Derived: past expiry, or within 30 days. */
  status: 'expired' | 'soon' | 'ok';
}

export interface ExpiringBatchPage {
  rows: ExpiringBatchRow[];
  pageCount: number;
}

// ─── saved layout ───────────────────────────────────────────────────
/**
 * One placed widget. `colSpan` is in 12ths, matching the CSS grid.
 * Persisted per employee via `employee/setEmployeeDashboard`.
 */
export interface PlacedWidget {
  slug: string;
  rowId: string;
  colSpan: number;
  order: number;
}

export interface DashboardLayout {
  rows: { id: string; widgets: PlacedWidget[] }[];
}
