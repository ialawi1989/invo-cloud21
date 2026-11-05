export type PeriodType = 'monthly' | 'quarterly' | 'yearly';

export const PERIOD_TYPES: PeriodType[] = ['monthly', 'quarterly', 'yearly'];

/** A period picked by the user: the year plus the month / quarter that applies to the period type. */
export interface PeriodAnchor {
  period: PeriodType;
  year: number;
  /** 1-12, used by `monthly`. */
  month: number;
  /** 1-4, used by `quarterly`. */
  quarter: number;
}

/** The query the summary / daily / branch endpoints expect. */
export interface PeriodPayload {
  period: PeriodType;
  year: number;
  month?: number;
  quarter?: number;
}

/** A saved target (`salesTarget/list`). Dates come back as `YYYY-MM-DD`; amounts as numeric strings. */
export interface SavedTarget {
  id: string;
  period: PeriodType;
  dateFrom: string;
  dateTo: string;
  workingDays: number;
  totalSalesTarget: number | string;
  netSalesTarget: number | string;
  currency: string;
}

export type TargetStatus = 'Active' | 'Closed' | 'Upcoming';

/** `salesTarget/getTargetSales/:id?/summary` */
export interface SalesTargetSummary {
  period: string;
  dateFrom: string;
  dateTo: string;
  currency: string;
  totals: {
    orderCount: number;
    totalSales: number;
    netSales: number;
    prevOrderCount: number;
    prevTotalActual: number;
    prevNetActual: number;
  };
  targets: { totalSalesTarget: number; netSalesTarget: number; prevTotalSalesTarget: number | null };
  achievement: { totalSalesPct: number | null; netSalesPct: number | null };
  runRate: { daysPassed: number; workingDays: number; daysRemaining: number };
  forecast: { forecastTotal: number; prevForecastTotal: number; status: string };
}

/** `salesTarget/getDailySalesTarget/:id?/daily` */
export interface DailySalesTarget {
  labels: string[];
  actual: number[];
  requiredDaily: number;
}

export interface BranchSalesRow {
  branchId: string;
  branchName: string;
  netSales: number;
  numberOfInvoices: number;
  targetAmt: number | null;
  achievementPct: number | null;
  forecast: number;
  status: string;
}

/** `salesTarget/getBranchSalesTarget/:id?/branches` */
export interface BranchSalesTarget {
  currency: string;
  daysPassed: number;
  workingDays: number;
  rows: BranchSalesRow[];
}

export interface SaveSalesTargetPayload {
  period: PeriodType;
  dateFrom: string;
  dateTo: string;
  workingDays: number;
  totalSalesTarget: number;
  netSalesTarget: number;
  currency: string;
  branches: { branchId: string; totalSalesTarget: number; netSalesTarget: number }[];
  forward?: { count: number; mode: 'overwrite' | 'skip' };
}

// ─── What the dashboard draws ───────────────────────────────────────────────

export interface TargetKpi {
  currency: string;
  orders: number;
  ordersPrev: number;
  ordersDelta: number | null;
  netPerOrder: number;
  totalSales: number;
  totalTarget: number;
  totalPrev: number;
  totalPct: number | null;
  totalForecast: number;
  totalStatus: string;
  totalDelta: number | null;
  netSales: number;
  netTarget: number;
  netPrev: number;
  netPct: number | null;
  netDelta: number | null;
  netRunRate: number;
  netReqRate: number;
}

export interface TargetBranchRow {
  branchId: string;
  branchName: string;
  orderCount: number;
  currentSales: number;
  target: number;
  forecast: number;
  ach: number | null;
  status: string;
}

export interface TargetDashboard {
  dateFrom: string;
  dateTo: string;
  dayIndex: number;
  periodDays: number;
  kpi: TargetKpi;
  branches: TargetBranchRow[];
  /** Current / forecast / target of the bar chart, and the previous period's when it had a target. */
  progress: { cur: number[]; prev: number[] | null; target: number };
  daily: { labels: string[]; actuals: number[]; requiredDaily: number };
}
