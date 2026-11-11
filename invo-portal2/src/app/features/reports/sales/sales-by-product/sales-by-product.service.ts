import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

/**
 * Gross → net breakdown of a row. `qty` / `salesAmount` stay NET:
 *   soldQty − voidedQty − returnedQty = qty
 *   grossSales − voidAmount − returnAmount = salesAmount   (all excl. tax)
 * The backend may send these as strings, so they are read through `num()` in the page.
 */
export interface SalesBreakdown {
  soldQty?: number | string;
  voidedQty?: number | string;
  returnedQty?: number | string;
  grossSales?: number | string;
  voidAmount?: number | string;
  returnAmount?: number | string;
}

export interface SalesByProductRecord extends SalesBreakdown {
  productId?: string | null;
  barcode: string;
  categoryName: string;
  productName: string;
  qty: number;
  salesAmount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

export interface SalesByProductData {
  records: SalesByProductRecord[];
  /** Totals of the WHOLE result (not just the visible page). */
  total: SalesBreakdown & { qty: number; salesAmount: number; discountTotal: number; taxTotal: number; total: number };
  pageCount: number;
  currentPage: number;
  count: number;
}

export interface SalesByProductSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

/**
 * Sales by Product data — `POST accounts/reports/salesByItemReport` (the route the legacy page calls). The backend
 * pages and sorts: `page` / `limit` / `sortBy` travel inside `filter`, as in the legacy.
 */
@Injectable({ providedIn: 'root' })
export class SalesByProductService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number, sort: SalesByProductSort | null): Promise<SalesByProductData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    if (sort) filter.sortBy = [sort];
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByItemReport', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      total: raw.total ?? { qty: 0, salesAmount: 0, discountTotal: 0, taxTotal: 0, total: 0 },
      pageCount: Number(raw.pageCount ?? 1) || 1,
      currentPage: Number(raw.currentPage ?? page) || page,
      count: Number(raw.count ?? 0) || 0,
    };
  }
}
