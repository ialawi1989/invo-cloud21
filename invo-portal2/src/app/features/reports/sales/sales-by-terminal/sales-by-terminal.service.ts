import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface TerminalRecord {
  terminalName: string; terminalId: string | null;
  invoiceProdQty: N; invoiceSales: N; creditNoteProdQty: N; creditNoteSales: N; totalSales: N;
}
export interface ListSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

/** Sales By Terminal — `POST accounts/reports/salesByTerminals` (sorted by the backend; not paged). */
@Injectable({ providedIn: 'root' })
export class SalesByTerminalService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, sort: ListSort | null): Promise<TerminalRecord[]> {
    const filter: ReportApiFilter = { ...f };
    if (sort) filter.sortBy = [sort];
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByTerminals', { filter }));
    const raw = res?.data ?? res ?? {};
    return Array.isArray(raw.records) ? raw.records : [];
  }
}
