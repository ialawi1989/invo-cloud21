import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface HourRecord { hour: string; qty: N; sales: N; Dailysales: N; }
export interface HoursProductRecord { productName: string; totalQty: N; totalSales: N; hours: HourRecord[]; }
export interface HoursByProductData { records: HoursProductRecord[]; count: number; pageCount: number; }

/** Sales By Hours By Product — `POST accounts/reports/salesByHoursbyProduct` (paged by product, by the backend). */
@Injectable({ providedIn: 'root' })
export class SalesByHoursByProductService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number): Promise<HoursByProductData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByHoursbyProduct', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
