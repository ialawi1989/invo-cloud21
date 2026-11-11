import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

export interface ProductCategoryRecord {
  categoryName: string;
  productName: string;
  invoiceProdQty: number; invoiceSales: number;
  creditNoteProdQty: number; creditNoteSales: number;
  totalSalesQty: number; totalSales: number;
  /** The category's own totals — sent on the first record of each category only. */
  invoiceProdQtyPerCategory?: number; invoiceSalesPerCategory?: number;
  creditNoteProdQtyPerCategory?: number; creditNoteSalesPerCategory?: number;
  salesQtyTotalPerCategory?: number; salesTotalPerCategory?: number;
}

export interface ProductCategoryTotal {
  invoiceProdQty: number; invoiceSales: number; creditNoteProdQty: number; creditNoteSales: number;
  totalSalesQty: number; totalSales: number;
}

export interface ProductCategoryData { records: ProductCategoryRecord[]; total: ProductCategoryTotal; pageCount: number; count: number; }

/** `POST accounts/reports/salesByProductCategory` — paged by the backend (`page` / `limit` inside `filter`). */
@Injectable({ providedIn: 'root' })
export class SalesByProductsCategoryService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number): Promise<ProductCategoryData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByProductCategory', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: (Array.isArray(raw.records) ? raw.records : []).filter((r: any) => r != null),
      total: raw.total ?? { invoiceProdQty: 0, invoiceSales: 0, creditNoteProdQty: 0, creditNoteSales: 0, totalSalesQty: 0, totalSales: 0 },
      pageCount: Number(raw.pageCount ?? 1) || 1,
      count: Number(raw.count ?? 0) || 0,
    };
  }
}
