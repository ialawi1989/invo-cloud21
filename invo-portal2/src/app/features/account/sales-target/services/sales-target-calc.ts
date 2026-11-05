import {
  BranchSalesTarget, DailySalesTarget, PeriodAnchor, PeriodPayload, PeriodType, SalesTargetSummary,
  SavedTarget, TargetBranchRow, TargetDashboard, TargetKpi, TargetStatus,
} from '../models/sales-target.model';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 86_400_000;

/** Money-safe rounding to the 3 decimals the currencies here use. */
export const round3 = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

export function periodPayload(a: PeriodAnchor): PeriodPayload {
  switch (a.period) {
    case 'monthly': return { period: 'monthly', year: a.year, month: a.month };
    case 'quarterly': return { period: 'quarterly', year: a.year, quarter: a.quarter };
    default: return { period: 'yearly', year: a.year };
  }
}

/** First / last day of the period (inclusive) and how many days it has. */
export function periodRange(a: PeriodAnchor): { dateFrom: string; dateTo: string; workingDays: number } {
  let start: Date, end: Date;
  if (a.period === 'monthly') {
    start = new Date(a.year, a.month - 1, 1);
    end = new Date(a.year, a.month, 0);
  } else if (a.period === 'quarterly') {
    const sm = (a.quarter - 1) * 3;
    start = new Date(a.year, sm, 1);
    end = new Date(a.year, sm + 3, 0);
  } else {
    start = new Date(a.year, 0, 1);
    end = new Date(a.year, 11, 31);
  }
  return { dateFrom: ymd(start), dateTo: ymd(end), workingDays: Math.round((end.getTime() - start.getTime()) / DAY) + 1 };
}

/** `YYYY-MM-DD` (or an ISO timestamp) as a local date - without the UTC shift `new Date('2026-05-01')` would add. */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The period a saved target covers, as the anchor the pickers use. */
export function anchorOfTarget(t: Pick<SavedTarget, 'period' | 'dateFrom'>): PeriodAnchor {
  const d = parseYmd(t.dateFrom);
  return { period: t.period, year: d.getFullYear(), month: d.getMonth() + 1, quarter: Math.floor(d.getMonth() / 3) + 1 };
}

/** Does the saved target cover exactly the period of the anchor? */
export function targetMatches(t: SavedTarget, a: PeriodAnchor): boolean {
  if (t.period !== a.period) return false;
  const x = anchorOfTarget(t);
  if (a.period === 'monthly') return x.year === a.year && x.month === a.month;
  if (a.period === 'quarterly') return x.year === a.year && x.quarter === a.quarter;
  return x.year === a.year;
}

export function targetStatus(t: Pick<SavedTarget, 'dateFrom' | 'dateTo'>): TargetStatus {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (now < parseYmd(t.dateFrom)) return 'Upcoming';
  if (now > parseYmd(t.dateTo)) return 'Closed';
  return 'Active';
}

export function deltaPct(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Forecast against target as a status: Ahead >= 100%, OnTrack >= 80%, Behind > 0, else Critical (same as the server's). */
export function statusFromPct(pct: number): string {
  if (pct >= 100) return 'Ahead';
  if (pct >= 80) return 'OnTrack';
  if (pct > 0) return 'Behind';
  return 'Critical';
}

export function fmtShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}

const num = (v: unknown) => Number(v) || 0;

/** Turns the three endpoint answers into what the dashboard draws (legacy `buildDashboardData`). */
export function buildDashboard(
  summary: SalesTargetSummary, daily: DailySalesTarget | null, branches: BranchSalesTarget | null, compare: boolean,
): TargetDashboard {
  const totals = summary.totals, targets = summary.targets, ach = summary.achievement, run = summary.runRate, fc = summary.forecast;
  const totalTarget = num(targets.totalSalesTarget);
  const netTarget = num(targets.netSalesTarget);
  const netSales = num(totals.netSales);
  const forecastPct = totalTarget > 0 ? (num(fc.forecastTotal) / totalTarget) * 100 : 0;

  const kpi: TargetKpi = {
    currency: summary.currency,
    orders: num(totals.orderCount),
    ordersPrev: num(totals.prevOrderCount),
    ordersDelta: compare ? deltaPct(num(totals.orderCount), num(totals.prevOrderCount)) : null,
    netPerOrder: num(totals.orderCount) > 0 ? netSales / num(totals.orderCount) : 0,
    totalSales: num(totals.totalSales),
    totalTarget,
    totalPrev: num(totals.prevTotalActual),
    totalPct: ach.totalSalesPct,
    totalForecast: num(fc.forecastTotal),
    totalStatus: totalTarget > 0 ? statusFromPct(forecastPct) : 'NoTarget',
    totalDelta: compare ? deltaPct(num(totals.totalSales), num(totals.prevTotalActual)) : null,
    netSales,
    netTarget,
    netPrev: num(totals.prevNetActual),
    netPct: ach.netSalesPct,
    netDelta: compare ? deltaPct(netSales, num(totals.prevNetActual)) : null,
    netRunRate: run.daysPassed > 0 ? netSales / run.daysPassed : 0,
    netReqRate: run.daysRemaining > 0 ? Math.max(0, (netTarget - netSales) / run.daysRemaining) : 0,
  };

  const hasPrev = targets.prevTotalSalesTarget != null;
  const progress = {
    cur: [num(totals.totalSales), num(fc.forecastTotal), totalTarget],
    prev: hasPrev ? [num(totals.prevTotalActual), num(fc.prevForecastTotal), totalTarget] : null,
    target: totalTarget,
  };

  const rows: TargetBranchRow[] = (branches?.rows ?? []).map(b => ({
    branchId: b.branchId,
    branchName: b.branchName,
    orderCount: num(b.numberOfInvoices),
    currentSales: num(b.netSales),
    target: num(b.targetAmt),
    forecast: num(b.forecast),
    ach: b.achievementPct,
    status: b.status,
  }));

  return {
    dateFrom: summary.dateFrom,
    dateTo: summary.dateTo,
    dayIndex: num(run.daysPassed),
    periodDays: num(run.workingDays),
    kpi,
    branches: rows,
    progress,
    daily: { labels: daily?.labels ?? [], actuals: (daily?.actual ?? []).map(num), requiredDaily: num(daily?.requiredDaily) },
  };
}

export const periodLabelKey = (p: PeriodType) => 'SALES_TARGET.PERIOD.' + p;
