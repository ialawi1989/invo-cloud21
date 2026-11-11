import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;
export type VoidTiming = 'sameDay' | 'differentDay' | 'differentMonth' | 'differentYear';

/** One main-table row: an invoice voided on one business day. */
export interface VoidedSalesRecord {
  invoiceId: string; invoiceNumber: string; invoiceDate: string; voidDate: string; voidBusinessDate: string;
  voidTiming: VoidTiming; customerName: string;
  itemsCount: N; voidedQty: N; saleAmount: N; salesAmount: N; discountTotal: N; taxTotal: N; voidAmount: N;
  employeeName: string | null; voidReason: string | null;
}

export interface VoidedSalesTotal {
  voidedInvoices: N; voidedQty: N; salesAmount: N; discountTotal: N; taxTotal: N; voidAmount: N;
}

export interface VoidedSalesData { records: VoidedSalesRecord[]; count: number; total: VoidedSalesTotal | null; pageCount: number; }

/** One voided line inside an expanded row. */
export interface VoidedItemRecord {
  id: string; productId: string | null; productName: string; barcode: string | null; parentId: string | null;
  voidedQty: N; unitPrice: N; salesAmount: N; discountTotal: N; taxTotal: N; voidAmount: N;
  originalQty: N; originalAmount: N; voidDate: string; voidReason: string | null; waste: boolean; employeeName: string | null;
}

export interface VoidedItemsData { records: VoidedItemRecord[]; total: Omit<VoidedSalesTotal, 'voidedInvoices'> | null; }
export interface ListSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

/**
 * Voided Sales — `POST accounts/reports/voidedSalesReport` (invoices voided in the period, by VOID date; paged and sorted
 * by the backend) and `voidedSalesReportDetails` (the voided items of one invoice on one business day).
 */
@Injectable({ providedIn: 'root' })
export class VoidedSalesService {
  private api = inject(ApiService);

  private async post(route: string, filter: ReportApiFilter): Promise<any> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    return res?.data ?? res ?? {};
  }

  async load(f: ReportApiFilter, page: number, limit: number, sort: ListSort | null): Promise<VoidedSalesData> {
    const filter: ReportApiFilter = { ...f, page, limit };
    if (sort) filter.sortBy = [sort];
    const raw = await this.post('voidedSalesReport', filter);
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      total: raw.total ?? null,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }

  /** Same opening-hour mode and branches as the main request, or the business day would not match. */
  async details(record: Pick<VoidedSalesRecord, 'invoiceId' | 'voidBusinessDate'>, scope: { applyOpeningHour?: boolean; branches?: string[] }): Promise<VoidedItemsData> {
    const raw = await this.post('voidedSalesReportDetails', {
      invoiceId: record.invoiceId, voidBusinessDate: record.voidBusinessDate,
      applyOpeningHour: !!scope.applyOpeningHour, branches: scope.branches ?? [],
    });
    return { records: Array.isArray(raw.records) ? raw.records : [], total: raw.total ?? null };
  }
}
