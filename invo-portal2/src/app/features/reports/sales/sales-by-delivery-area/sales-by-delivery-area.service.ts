import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface DeliveryAreaRecord {
  address: string | null; numberOfInvoices: N; invoiceSales: N; creditNoteSales: N; totalSales: N; salesAvg: N;
}
export interface DeliveryAreaTotal { numberOfInvoices: N; invoiceSales: N; creditNoteSales: N; totalSales: N; salesAvg: N; }
export interface DeliveryAreaData { records: DeliveryAreaRecord[]; count: number; total: DeliveryAreaTotal | null; pageCount: number; }
export interface ListSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

/** Sales By Delivery Area — `POST accounts/reports/getSalesByDeliveryArea` (paged and sorted by the backend). */
@Injectable({ providedIn: 'root' })
export class SalesByDeliveryAreaService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number, sort: ListSort | null): Promise<DeliveryAreaData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    if (sort) filter.sortBy = [sort];
    const res = await this.api.request<any>(this.api.post('accounts/reports/getSalesByDeliveryArea', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      total: raw.total ?? null,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
