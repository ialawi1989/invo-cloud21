import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface ProductVsServiceRecord {
  serviceId: string | null; serviceName: string | null; productName: string | null;
  invoiceProdQty: N; invoiceSales: N; creditNoteProdQty: N; creditNoteSales: N; totalSalesQty: N; totalSales: N;
  invoiceProdQtyPerService: N; invoiceSalesPerService: N; creditNoteProdQtyPerService: N; creditNoteSalesPerService: N;
  salesQtyTotalPerService: N; salesTotalPerService: N;
}
export interface ProductVsServiceTotal {
  invoiceProdQty: N; invoiceSales: N; creditNoteProdQty: N; creditNoteSales: N; totalSalesQty: N; totalSales: N;
}
export interface ProductVsServiceData { records: ProductVsServiceRecord[]; count: number; total: ProductVsServiceTotal | null; pageCount: number; }

/** Sales By Product Vs Service — `POST accounts/reports/salesByMenuProductVsService` (paged by the backend, ordered by service). */
@Injectable({ providedIn: 'root' })
export class SalesByProductVsServiceService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number): Promise<ProductVsServiceData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByMenuProductVsService', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records.filter((r: unknown) => !!r) : [],
      count: Number(raw.count ?? 0) || 0,
      total: raw.total ?? null,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
