import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

type N = number | string;

/** One invoice or credit note that includes the product in the period. */
export interface ItemTransactionRecord {
  transactionType: 'invoice' | 'creditNote';
  transactionId: string;
  transactionNumber: string;
  transactionDate: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  branchName: string | null;
  employeeName: string | null;
  soldQty: N; voidedQty: N; returnedQty: N; netQty: N; unitPrice: N;
  salesAmount: N; discountTotal: N; taxTotal: N; total: N;
  partOf: string | null;
}

export interface ItemTransactionsTotal {
  customersCount: N; soldQty: N; voidedQty: N; returnedQty: N; netQty: N;
  salesAmount: N; discountTotal: N; taxTotal: N; total: N;
}

export interface ItemTransactionsData {
  records: ItemTransactionRecord[];
  count: number;
  total: ItemTransactionsTotal | null;
  pageCount: number;
}

export interface ListSort { sortValue: string; sortDirection: 'asc' | 'desc'; }

/** `POST accounts/reports/salesByItemTransactions` — paged and sorted by the backend (`page` / `limit` / `sortBy` inside `filter`). */
@Injectable({ providedIn: 'root' })
export class SalesByItemTransactionsService {
  private api = inject(ApiService);

  async load(
    f: ReportApiFilter, product: { id: string; name: string }, page: number, limit: number, sort: ListSort | null,
  ): Promise<ItemTransactionsData> {
    // The product is identified by id, or by name for open items (the legacy rule).
    const filter: ReportApiFilter = { ...f, page, limit };
    delete filter['productIds'];
    if (product.id) filter['productId'] = product.id; else filter['productName'] = product.name;
    if (sort) filter.sortBy = [sort];
    const res = await this.api.request<any>(this.api.post('accounts/reports/salesByItemTransactions', { filter }));
    const raw = res?.data ?? res ?? {};
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      count: Number(raw.count ?? 0) || 0,
      total: raw.total ?? null,
      pageCount: Number(raw.pageCount ?? 1) || 1,
    };
  }
}
