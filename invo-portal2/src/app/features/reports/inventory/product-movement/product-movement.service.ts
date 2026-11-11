import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface ProductMovementRecord {
  type: string; name: string | null; productCode: string | null; createdAt: string; branchName: string | null;
  qtyUsage: N; qtyBalance: N; cost: N; costBalance: N; unitCost?: N; transactionId: string | null;
}
export interface ProductMovementData { records: ProductMovementRecord[]; count: number; pageCount: number; }

/** Product Movement — `POST accounts/reports/productMovementReport` (one product's stock card; paged by the backend). */
@Injectable({ providedIn: 'root' })
export class ProductMovementService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number): Promise<ProductMovementData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    const res = await this.api.request<any>(this.api.post('accounts/reports/productMovementReport', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
