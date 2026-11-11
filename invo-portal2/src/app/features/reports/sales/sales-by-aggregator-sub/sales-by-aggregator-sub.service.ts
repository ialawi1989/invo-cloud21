import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface AggregatorSubRecord { id?: string | null; code: string; aggregatorId: string | null; type: string; totalSales: N; total: N; }
export interface AggregatorSubData { records: AggregatorSubRecord[]; count: number; totalSales: N; total: N; pageCount: number; }

/**
 * The invoices and credit notes behind one Sales by Aggregator row (`salesByAggregatorSubReport`) or one Sales by Service row
 * (`salesByServiceId`) — the same list shape, paged by the backend.
 */
@Injectable({ providedIn: 'root' })
export class SalesByAggregatorSubService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number, route = 'salesByAggregatorSubReport'): Promise<AggregatorSubData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      totalSales: raw.totalSales ?? 0,
      total: raw.total ?? 0,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
