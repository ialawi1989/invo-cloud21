import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

export interface InvoiceSalesRecord {
  invoiceId: string | null; salesDate: string; invoiceDate: string; invoiceNumber: string; branchName: string;
  sales: N; discount: N; tax: N; totalSales: N;
}
export interface InvoiceSalesTotal { sales: N; discount: N; tax: N; totalSales: N; }
export interface InvoiceSalesData { records: InvoiceSalesRecord[]; count: number; total: InvoiceSalesTotal | null; pageCount: number; }
export interface ListSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

/**
 * The backend's ORDER BY uses its own SQL names: the "Sales" column is `totalSales` and the "Total Sales" column is `total`
 * (the record is renamed afterwards), so the screen's column keys are translated before they are sent.
 */
const SORT_COLUMN: Record<string, string> = { sales: 'totalSales', totalSales: 'total' };

/** Sales By Invoice — `POST accounts/reports/salesByInvoice` (paged and sorted by the backend). */
@Injectable({ providedIn: 'root' })
export class SalesByInvoiceService {
  private api = inject(ApiService);

  async load(f: ReportApiFilter, page: number, limit: number, sort: ListSort | null): Promise<InvoiceSalesData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    if (sort) filter.sortBy = [{ sortValue: SORT_COLUMN[sort.sortValue] ?? sort.sortValue, sortDirection: sort.sortDirection }];
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByInvoice', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      total: raw.total ?? null,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
