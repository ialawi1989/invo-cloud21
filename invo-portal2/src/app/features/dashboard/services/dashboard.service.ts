import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '@core/http';

import {
  AccountSummaryBlock,
  BranchSalesRow,
  DashboardLayout,
  DashboardScope,
  DashboardSummary,
  ExpiringBatchPage,
  ExpiringBatchRow,
  IncomeExpense,
  IncomeExpensePoint,
  LabelValue,
  LowStockRow,
  PaymentsFlow,
  PaymentsFlowPoint,
} from './dashboard.types';

/** The scope every widget endpoint takes. */
const body = (s: DashboardScope, extra: Record<string, unknown> = {}) => ({
  interval: { from: s.from, to: s.to },
  branchId: s.branchId,
  ...extra,
});

/**
 * DashboardService — one method per widget.
 *
 * Three deliberate departures from the legacy service:
 *
 * 1. **Everything returns an Observable, never a Promise.** This is what makes
 *    requests cancellable: HttpClient aborts the underlying XHR when its
 *    subscription is torn down. A widget piped through `takeUntilDestroyed`
 *    therefore drops its in-flight request the moment you navigate away, and
 *    `switchMap` cancels the previous request when the scope changes. A Promise
 *    (via `firstValueFrom`) cannot be cancelled — the request runs to completion
 *    and resolves into a dead component. Legacy hit this and hand-rolled an
 *    `AbortController` in exactly one widget; the other seventeen leaked.
 * 2. **Errors propagate.** The legacy version swallowed every non-401 failure in
 *    an empty `catch`, leaving the promise pending forever — a failed widget
 *    spun forever with no way to tell "loading" from "broken".
 * 3. **Shapes are normalized here.** Widgets receive `LabelValue[]` with `share`
 *    already computed, so a dozen widgets share one chart and one table
 *    component instead of each re-deriving percentages.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);

  // ─── ranked / charted widgets ─────────────────────────────────────
  // These all reduce to LabelValue[]; only the endpoint and field names
  // differ, so one private helper covers eleven widgets.

  private series(
    path: string,
    scope: DashboardScope,
    labelKey: string,
    valueKey: string,
    secondaryKey?: string,
  ): Observable<LabelValue[]> {
    return this.api.post<any>(path, body(scope)).pipe(
      map((res: any) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : (res?.data?.list ?? []);
        const rows: LabelValue[] = raw.map((r) => ({
          label: String(r?.[labelKey] ?? '-'),
          value: Number(r?.[valueKey]) || 0,
          secondary: secondaryKey != null ? Number(r?.[secondaryKey]) || 0 : undefined,
        }));
        return withShare(rows);
      }),
    );
  }

  topCustomers(s: DashboardScope)      { return this.series('dashboard/TopCustomers', s, 'customerName', 'sales'); }
  topItems(s: DashboardScope)          { return this.series('dashboard/topItemBySales', s, 'productName', 'sales'); }
  salesByService(s: DashboardScope)    { return this.series('dashboard/getSalesByService', s, 'serviceName', 'sales'); }
  salesByCategory(s: DashboardScope)   { return this.series('dashboard/topCategoryBySales', s, 'categoryName', 'sales'); }
  salesByDepartment(s: DashboardScope) { return this.series('dashboard/topDepartmentBySales', s, 'departmentName', 'sales'); }
  salesByBrand(s: DashboardScope)      { return this.series('dashboard/topBrandBySales', s, 'brandName', 'sales'); }
  salesBySource(s: DashboardScope)     { return this.series('dashboard/salesBySource', s, 'sourceName', 'sales'); }
  paymentMethods(s: DashboardScope)    { return this.series('dashboard/PaymentMethodOverView', s, 'paymentMethodName', 'total'); }
  salesByEmployee(s: DashboardScope)   { return this.series('dashboard/getSalesByEmployee', s, 'employeeName', 'salestotal', 'productQty'); }

  /** Hourly sales — carries money and invoice count so the widget can toggle. */
  salesByTime(s: DashboardScope) {
    return this.series('dashboard/salesByTime', s, 'hour', 'totalSales', 'invoiceTotal');
  }

  /**
   * Online invoices. The server leaks an unaliased column here, so the label
   * arrives keyed as "?column?" — handled at the edge, never reaching a template.
   */
  onlineInvoices(s: DashboardScope): Observable<LabelValue[]> {
    return this.api.post<any>('dashboard/onlineInvoices', body(s)).pipe(
      map((res: any) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : [];
        return withShare(raw.map((r) => ({
          label: String(r?.['?column?'] ?? r?.label ?? '-'),
          value: Number(r?.numberOfInvoices) || 0,
        })));
      }),
    );
  }

  /** Daily sales. Takes its own window — the widget has local period buttons. */
  salesByDay(from: string, to: string, branchId: string | null): Observable<LabelValue[]> {
    return this.api.post<any>('dashboard/salesByDay', { interval: { from, to }, branchId }).pipe(
      map((res: any) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : [];
        return raw.map((r) => ({ label: String(r?.date ?? ''), value: Number(r?.totalSales) || 0 }));
      }),
    );
  }

  // ─── business summary ─────────────────────────────────────────────
  branchSales(s: DashboardScope, applyOpeningHour: boolean): Observable<BranchSalesRow[]> {
    return this.api.post<any>('dashboard/BranchSales', body(s, { applyOpeningHour })).pipe(
      map((res: any) => {
        const raw: any[] = Array.isArray(res?.data) ? res.data : [];
        const rows: BranchSalesRow[] = raw.map((r) => ({
          branchId: String(r?.branchId ?? ''),
          branchName: String(r?.branchName ?? '-'),
          numberOfInvoices: Number(r?.numberOfInvoices) || 0,
          sales: Number(r?.sales) || 0,
          discountTotal: Number(r?.discountTotal) || 0,
          taxTotal: Number(r?.taxTotal) || 0,
          total: Number(r?.total) || 0,
          totalReturn: Number(r?.totalReturn) || 0,
          netSales: Number(r?.netSales) || 0,
          share: 0,
        }));
        const totalSales = rows.reduce((sum, r) => sum + r.sales, 0);
        rows.forEach((r) => { r.share = totalSales > 0 ? (r.sales / totalSales) * 100 : 0; });
        return rows;
      }),
    );
  }

  // ─── accounting blocks ────────────────────────────────────────────
  summary(s: DashboardScope): Observable<DashboardSummary> {
    return this.api.post<any>('accounts/getDashboardSummary', body(s)).pipe(
      map((res: any) => {
        const d = res?.data ?? {};
        return {
          costOfGoodsSold: block(d?.costOfGoodsSold),
          payable: block(d?.payable),
          receivable: block(d?.receivable),
          netProfit: Number(d?.netProfit) || 0,
        };
      }),
    );
  }

  /**
   * Cash/bank movement, bucketed by month. Closing is derived rather than read:
   * the server returns raw transactions plus an opening balance, and outgoing
   * arrives negative.
   */
  paymentsFlow(s: DashboardScope): Observable<PaymentsFlow> {
    return this.api.post<any>('accounts/getPaymentsFlow', body(s)).pipe(
      map((res: any) => {
        const d = res?.data ?? {};
        const cash = d?.cash ?? {};
        const bank = d?.bank ?? {};
        const opening = num(cash?.opeiningBalance?.balance) + num(bank?.opeiningBalance?.balance);

        const buckets = new Map<string, PaymentsFlowPoint>();
        let incoming = 0;
        let outgoing = 0;

        const walk = (txns: any[], key: 'cash' | 'bank') => {
          (txns ?? []).forEach((t) => {
            const label = monthLabel(t?.createdAt);
            if (!label) return;
            const point = buckets.get(label) ?? { label, cash: 0, bank: 0 };
            point[key] += num(t?.incoming) + num(t?.outgoing);
            buckets.set(label, point);
            incoming += num(t?.incoming);
            outgoing += Math.abs(num(t?.outgoing));
          });
        };
        walk(cash?.transactions, 'cash');
        walk(bank?.transactions, 'bank');

        return {
          openingBalance: opening,
          incoming,
          outgoing,
          closingBalance: opening + incoming - outgoing,
          points: [...buckets.values()],
        };
      }),
    );
  }

  incomeExpense(s: DashboardScope): Observable<IncomeExpense> {
    return this.api.post<any>('accounts/getIncomeExpenseSummary', body(s)).pipe(
      map((res: any) => {
        const d = res?.data ?? {};
        const buckets = new Map<string, IncomeExpensePoint>();
        const walk = (rows: any[], key: 'income' | 'expense') => {
          (rows ?? []).forEach((r) => {
            const label = monthLabel(r?.createdAt);
            if (!label) return;
            const point = buckets.get(label) ?? { label, income: 0, expense: 0 };
            point[key] += Math.abs(num(r?.amount));
            buckets.set(label, point);
          });
        };
        walk(d?.income, 'income');
        walk(d?.expense, 'expense');

        const points = [...buckets.values()];
        const totalIncome = points.reduce((sum, p) => sum + p.income, 0);
        const totalExpense = points.reduce((sum, p) => sum + p.expense, 0);
        return { totalIncome, totalExpense, net: totalIncome - totalExpense, points };
      }),
    );
  }

  // ─── period-independent tiles ─────────────────────────────────────
  openInvoices(): Observable<number> {
    return this.api.post<any>('dashboard/getOpenInvoices', {}).pipe(
      map((res: any) => Number(res?.data?.totalInvoices) || 0));
  }

  openCashiers(): Observable<number> {
    return this.api.post<any>('dashboard/numberOfOpenCashiers', {}).pipe(
      map((res: any) => Number(res?.data?.totalCashiers) || 0));
  }

  // ─── inventory ────────────────────────────────────────────────────
  lowStock(branchId: string | null): Observable<LowStockRow[]> {
    return this.api.post<any>('product/reorderProducts/', { branchId }).pipe(
      map((res: any) => {
        const raw: any[] = res?.data ?? [];
        return raw.map((r) => ({
          name: String(r?.name ?? '-'),
          type: String(r?.type ?? ''),
          branchName: String(r?.branchName ?? ''),
          onHand: Number(r?.onHand) || 0,
        }));
      }),
    );
  }

  expiringBatches(branchId: string | null, page: number, limit: number): Observable<ExpiringBatchPage> {
    return this.api.post<any>('product/getExpireBatches/', {
      page,
      limit,
      // The endpoint wants an explicit empty array for "all branches".
      filter: { branches: branchId ? [branchId] : [] },
    }).pipe(
      map((res: any) => {
        const d = res?.data ?? {};
        const raw: any[] = d?.records ?? [];
        return {
          rows: raw.map((r): ExpiringBatchRow => ({
            productName: String(r?.productName ?? '-'),
            batch: String(r?.batch ?? ''),
            prodDate: String(r?.prodDate ?? ''),
            expireDate: String(r?.expireDate ?? ''),
            onHand: Number(r?.onHand) || 0,
            status: expiryStatus(r?.expireDate),
          })),
          pageCount: Number(d?.pageCount) || 1,
        };
      }),
    );
  }

  // ─── saved layout ─────────────────────────────────────────────────
  saveLayout(layout: DashboardLayout): Observable<boolean> {
    // Flattened back to the legacy per-widget shape the endpoint expects.
    const dashBoardOptions = layout.rows.flatMap((row, rowIndex) =>
      row.widgets.map((w, i) => ({
        slug: w.slug,
        isAdded: true,
        index: rowIndex,
        rowId: row.id,
        colSpan: w.colSpan,
        order: i,
      })),
    );
    return this.api.post<any>('employee/setEmployeeDashboard', { dashBoardOptions }).pipe(
      map((res: any) => !!res?.success));
  }
}

// ─── helpers ────────────────────────────────────────────────────────
const num = (v: unknown): number => Number(v) || 0;

function block(b: any): AccountSummaryBlock {
  return {
    balance: num(b?.balance),
    trail: (b?.lastSixMonthsSummary ?? []).map((m: any) => num(m?.total)),
  };
}

/** Share of total, so ranked tables and progress bars don't each recompute it. */
function withShare(rows: LabelValue[]): LabelValue[] {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return rows.map((r) => ({ ...r, share: total > 0 ? (r.value / total) * 100 : 0 }));
}

/** 'MMM YYYY' without pulling in a date library. */
function monthLabel(iso: unknown): string | null {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function expiryStatus(expire: unknown): ExpiringBatchRow['status'] {
  if (!expire) return 'ok';
  const d = new Date(String(expire));
  if (isNaN(d.getTime())) return 'ok';
  const days = (d.getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'expired';
  return days <= 30 ? 'soon' : 'ok';
}
