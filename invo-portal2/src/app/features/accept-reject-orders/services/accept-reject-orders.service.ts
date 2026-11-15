import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { PendingOrdersService } from '@core/layout/services/pending-orders.service';

import {
  LinePick, OnlineOrderLine, OnlineOrderListParams, OnlineOrderListResult, OnlineOrderRow,
} from '../models/accept-reject-orders.model';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/**
 * Accept / reject (cloud) orders API - legacy `AccountService.getOnlineInvoices` / `updateInvoiceStatus`:
 * `POST accounts/getOnlineInvoices/` and `POST accounts/updateInvoiceStatus` (InvoCloudBack `routes/v1/app/accounts.ts`
 * -> `InvoiceController`). The topbar bell (`PendingOrdersService`) is re-synced after every status change.
 */
@Injectable({ providedIn: 'root' })
export class AcceptRejectOrdersService {
  private api = inject(ApiService);
  private pending = inject(PendingOrdersService);

  async getOrders(params: OnlineOrderListParams): Promise<OnlineOrderListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      // Left out when unsorted: the backend reads `sortBy.sortValue` straight into its ORDER BY.
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      status: params.status,
      filter: { branches: params.branches ?? [] },
    };
    const res = await this.api.request<any>(this.api.post('accounts/getOnlineInvoices/', body));
    const list: OnlineOrderRow[] = (res?.data?.list ?? []).map((o: any) => this.mapOrder(o));
    return { list, count: num(res?.data?.count ?? list.length), pageCount: num(res?.data?.pageCount ?? 1) || 1 };
  }

  /** Reject, or accept an order with no serial / batch lines. Returns the raw `{ success, msg }` envelope. */
  async updateStatus(order: Pick<OnlineOrderRow, 'id' | 'branchId'>, status: 'Accepted' | 'Rejected'): Promise<any> {
    const res = await this.api.request<any>(this.api.post('accounts/updateInvoiceStatus', {
      invoiceId: order.id,
      branchId: order.branchId,
      status,
      rejectReason: '',
    }));
    if (res?.success !== false) void this.pending.load();
    return res;
  }

  /** Accept an order after picking serials / batches for its lines. */
  async acceptWithLines(order: Pick<OnlineOrderRow, 'id' | 'branchId'>, lines: LinePick[]): Promise<any> {
    const res = await this.api.request<any>(this.api.post('accounts/updateInvoiceStatus', {
      invoiceId: order.id,
      branchId: order.branchId,
      status: 'Accepted',
      lines,
      rejectReason: '',
    }));
    if (res?.success !== false) void this.pending.load();
    return res;
  }

  private mapOrder(o: any): OnlineOrderRow {
    return {
      id: o.id,
      branchId: o.branchId ?? '',
      branchName: o.branchName ?? '',
      invoiceNumber: o.invoiceNumber ?? '',
      customerName: o.customerName ?? null,
      employeeName: o.employeeName ?? null,
      total: num(o.total),
      status: o.status ?? '',
      invoiceDate: o.invoiceDate ?? null,
      dueDate: o.dueDate || null,
      createdAt: o.createdAt ?? null,
      onlineStatus: o.onlineData?.onlineStatus ?? '',
      lines: (Array.isArray(o.lines) ? o.lines : []).map((l: any): OnlineOrderLine => ({
        lineId: l.lineId,
        productId: l.productId ?? '',
        name: l.name ?? '',
        productType: l.productType ?? '',
        serials: arr(l.serials),
        batches: arr(l.batches),
        serial: '',
        batch: '',
      })),
    };
  }
}
