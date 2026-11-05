import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import {
  BranchSalesTarget, DailySalesTarget, PeriodPayload, PeriodType, SalesTargetSummary, SaveSalesTargetPayload,
  SavedTarget, TargetDashboard,
} from '../models/sales-target.model';
import { buildDashboard } from './sales-target-calc';

export interface SavedTargetQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  period?: PeriodType | 'all';
  year?: number | null;
  /** `totalSalesTarget` orders by the amount; anything else by the newest saved first (the server ignores a direction). */
  sortBy?: 'latest' | 'target';
}

/**
 * Sales target API - the endpoints of the legacy `SalesTargetService`, checked against InvoCloudBack
 * (`routes/v1/app/salesTarget.ts` -> `SalesTargetController` -> `salesTargetRepo`):
 *
 *   POST salesTarget/list                         saved targets (filter `period`, `year`; search matches the period only)
 *   GET  salesTarget/getTargetSales/:id?/summary  KPIs, forecast and previous-period figures
 *   GET  salesTarget/getDailySalesTarget/:id?/daily  sales per day with sales
 *   GET  salesTarget/getBranchSalesTarget/:id?/branches  per branch sales, target and forecast
 *   POST salesTarget/saveSalesTarget              create / update (same period) with the branch split, optional copy forward
 *
 * The summary / daily / branch handlers answer a failure as `{ success: true, data: [] }`, so an answer without
 * its object counts as an error here. `:id` is optional: without a saved target the same figures come back with a
 * zero target.
 */
@Injectable({ providedIn: 'root' })
export class SalesTargetService {
  private api = inject(ApiService);

  private async data<T>(req: ReturnType<ApiService['get']>): Promise<T | null> {
    const res: any = await this.api.request(req);
    const d = res?.data;
    if (d == null || Array.isArray(d)) {
      if (res?.msg || res?.message) throw new Error(res.msg ?? res.message);
      return null;
    }
    return d as T;
  }

  private path(kind: 'getTargetSales' | 'getDailySalesTarget' | 'getBranchSalesTarget', id: string, tail: string): string {
    return `salesTarget/${kind}${id ? '/' + id : ''}/${tail}`;
  }

  getSummary(id: string, p: PeriodPayload) {
    return this.data<SalesTargetSummary>(this.api.get(this.path('getTargetSales', id, 'summary'), { ...p }));
  }
  getDaily(id: string, p: PeriodPayload) {
    return this.data<DailySalesTarget>(this.api.get(this.path('getDailySalesTarget', id, 'daily'), { ...p }));
  }
  getBranches(id: string, p: PeriodPayload) {
    return this.data<BranchSalesTarget>(this.api.get(this.path('getBranchSalesTarget', id, 'branches'), { ...p }));
  }

  /** The three dashboard calls in parallel, folded into what the page draws. */
  async getDashboard(id: string, p: PeriodPayload, compare: boolean): Promise<TargetDashboard> {
    const [summary, daily, branches] = await Promise.all([this.getSummary(id, p), this.getDaily(id, p), this.getBranches(id, p)]);
    if (!summary) throw new Error('No sales target data for this period');
    return buildDashboard(summary, daily, branches, compare);
  }

  async list(q: SavedTargetQuery): Promise<{ rows: SavedTarget[]; total: number }> {
    const body: any = {
      page: q.page,
      limit: q.limit,
      searchTerm: q.searchTerm ?? '',
      sortBy: { sortValue: q.sortBy === 'target' ? 'totalSalesTarget' : 'createdAt', sortDirection: 'desc' },
    };
    const filter: any = {};
    if (q.period && q.period !== 'all') filter.period = q.period;
    if (q.year) filter.year = q.year;
    if (Object.keys(filter).length) body.filter = filter;

    const res: any = await this.api.request(this.api.post('salesTarget/list', body));
    if (res?.success === false) throw new Error(res.msg ?? '');
    const d = res?.data ?? {};
    return { rows: d.list ?? [], total: Number(d.count ?? 0) || 0 };
  }

  /** Saves (or updates the same period's) target; resolves the saved row, or throws the server's message. */
  async save(payload: SaveSalesTargetPayload): Promise<SavedTarget> {
    const res: any = await this.api.request(this.api.post('salesTarget/saveSalesTarget', payload));
    const d = res?.data;
    if (!d || Array.isArray(d) || !d.id) throw new Error(res?.msg ?? res?.message ?? '');
    return d as SavedTarget;
  }
}
