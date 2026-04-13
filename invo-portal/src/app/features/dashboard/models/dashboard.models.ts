// ─── Shared date-range param ─────────────────────────────────────────────────
export interface DateRange { from: string; to: string; }
export interface DashboardParams { interval: DateRange; branchId: string | null; }

// ─── Summary blocks ───────────────────────────────────────────────────────────
export interface SummaryData {
  costOfGoodsSold?: { lastSixMonthsSummary: { total: number }[]; opeiningBalance?: number };
  payable?:         { lastSixMonthsSummary: { total: number }[]; opeiningBalance?: number };
  receivable?:      { lastSixMonthsSummary: { total: number }[]; opeiningBalance?: number };
}

// ─── Business summary ────────────────────────────────────────────────────────
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
  percentage?: number;
  color?: string;
}

// ─── Chart data helpers ───────────────────────────────────────────────────────
export interface ChartSeries { name: string; data: number[]; color: string; }
export interface NameValue    { name: string; value: number; }

// ─── Customers ────────────────────────────────────────────────────────────────
export interface NewCustomer { id: string; name: string; email: string; createdAt: string; }
export interface TopCustomer { customerId: string; customerName: string; total: number; }

// ─── Widgets registry entry ───────────────────────────────────────────────────
export interface WidgetDef {
  slug: string;
  title: string;
  isAdded: boolean;
  index: number;
  colSpan: number;   // 3 | 4 | 6 | 8 | 9 | 12
  rowId: string;
  order: number;
  show: boolean;
  defaultHeight: number;
}
