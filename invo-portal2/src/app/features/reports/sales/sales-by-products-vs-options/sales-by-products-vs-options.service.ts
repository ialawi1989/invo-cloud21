import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface OptionRecord {
  productName: string; optionName: string;
  lineQty: N; qty: N; optionPrice: N; totalOptionPrice: N;
}

export interface OptionsTotal { lineQty?: N; qty: N; optionPrice: N; }
export interface OptionsData { records: OptionRecord[]; total: OptionsTotal | null; pageCount: number; count: number; }
export interface ListSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

/** `POST accounts/reports/salesByMenuProductVsOptions` — paged and sorted by the backend (`page` / `limit` / `sortBy` inside `filter`). */
@Injectable({ providedIn: 'root' })
export class SalesByProductsVsOptionsService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number, sort: ListSort | null): Promise<OptionsData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    if (sort) filter.sortBy = [sort];
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByMenuProductVsOptions', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: (Array.isArray(raw.records) ? raw.records : []).filter((r: any) => r != null),
      total: raw.total ?? null,
      pageCount: Number(raw.pageCount ?? 1) || 1,
      count: Number(raw.count ?? 0) || 0,
    };
  }
}
