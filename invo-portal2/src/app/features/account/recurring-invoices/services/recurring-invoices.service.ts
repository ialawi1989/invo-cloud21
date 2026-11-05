import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { RecurringInvoice } from '../models/recurring-invoice.model';

/**
 * Recurring Invoices API — the endpoints of the legacy `RecurringInvoiceService`, verified against
 * `InvoCloudBack` (routes/v1/app/accounts.ts → RecurringInvoice.controller → RecurringInvoice.repo):
 *
 *   POST   accounts/getRecurringInvoiceList          paged list (`filter.branches`; search by name / branch)
 *   GET    accounts/getRecurringInvoiceById/:id       edit payload (header + `transactionDetails`)
 *   GET    accounts/getRecurringInvoiceOverview/:id   read-only view (+ `nextInvoiceDate`, `childInvoices`)
 *   POST   accounts/saveRecurringInvoice              create (no `id`) / update, one endpoint
 *   DELETE accounts/deleteRecurringInvoice/:id        refused server-side once child invoices exist
 *
 * The list endpoint ignores `filter.fromDate` / `toDate` (legacy sent them anyway), so no date filter is offered.
 */
@Injectable({ providedIn: 'root' })
export class RecurringInvoicesService {
  private api = inject(ApiService);

  /** Paged list: `{ list, count, pageCount, startIndex, lastIndex }`. */
  async getList(param: any): Promise<any> {
    const d = (await this.api.request<any>(this.api.post('accounts/getRecurringInvoiceList', param)))?.data;
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list ?? [], count: d.count ?? 0, pageCount: d.pageCount ?? 0, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  /** The record for editing; `null` when the id does not resolve. */
  async getById(id: string): Promise<RecurringInvoice | null> {
    const raw = (await this.api.request<any>(this.api.get('accounts/getRecurringInvoiceById/' + id)))?.data;
    if (!raw?.id) return null;
    const r = new RecurringInvoice();
    r.ParseJson(raw);
    return r;
  }

  /** The read-only payload; the repo answers `{}` for an unknown id. */
  async getOverview(id: string): Promise<RecurringInvoice | null> {
    const raw = (await this.api.request<any>(this.api.get('accounts/getRecurringInvoiceOverview/' + id)))?.data;
    if (!raw?.id) return null;
    const r = new RecurringInvoice();
    r.ParseJson(raw);
    return r;
  }

  /**
   * Saves the profile. Returns the raw `{ success, msg, data }` body; like legacy it resolves the
   * server's error body on an HTTP failure so the caller can show `msg`.
   */
  async save(info: any): Promise<any> {
    const lines: any[] = info.transactionDetails?.lines ?? [];
    lines.forEach(l => {
      l.isNew = false;
      // Free-text lines carry no product. (Legacy also dropped the product of every line that had a
      // description — which silently turned catalogue items into notes; only empty ids are cleared here.)
      if (l.productId == '') l.productId = null;
    });
    try {
      return await this.api.request(this.api.post('accounts/saveRecurringInvoice', info));
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  delete = (id: string) => this.api.request(this.api.delete('accounts/deleteRecurringInvoice/' + id));

  /** Receivable accounts for the "Advanced options" picker (`accounts/getReceivableAccounts`, answers `{ list }`). */
  async getReceivableAccounts(): Promise<any[]> {
    return (await this.api.request<any>(this.api.post('accounts/getReceivableAccounts', {})))?.data?.list ?? [];
  }
}
