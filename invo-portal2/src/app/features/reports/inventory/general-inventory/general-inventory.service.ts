import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface GeneralInventoryRecord {
  productId: string | null; productName: string; categoryName: string | null; barcode: string | null;
  beginningQty: N; beginningAmount: N; receivingQty: N; receivingCost: N; usageQty: N; usageCost: N; endingQty: N; endingAmount: N;
}
export interface GeneralInventoryTotal {
  beginningQty: N; beginningAmount: N; receivingQty: N; receivingCost: N; usageQty: N; usageCost: N; endingQty: N; endingAmount: N;
}
export interface GeneralInventoryData { records: GeneralInventoryRecord[]; count: number; total: GeneralInventoryTotal | null; pageCount: number; }

/** General Inventory — `POST accounts/reports/getGeneralInventoryReport` (stock movement per product; paged by the backend). */
@Injectable({ providedIn: 'root' })
export class GeneralInventoryService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number): Promise<GeneralInventoryData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    const res = await this.api.request<any>(this.api.post('accounts/reports/getGeneralInventoryReport', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      total: raw.total ?? null,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
