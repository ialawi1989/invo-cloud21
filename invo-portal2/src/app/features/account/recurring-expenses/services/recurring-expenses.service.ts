import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { RecurringExpense } from '../models/recurring-expense.model';

/**
 * Recurring Expenses API — the endpoints of the legacy `RecurringExpenseService`, verified against
 * `InvoCloudBack` (routes/v1/app/accounts.ts → RecurringExpense.controller → RecurringExpense.repo):
 *
 *   POST   accounts/getRecurringExpenseList          paged list (`filter.branches`; search by name / branch)
 *   GET    accounts/getRecurringExpenseById/:id       edit payload (header + `transactionDetails`)
 *   GET    accounts/getRecurringExpenseOverview/:id   read-only view (+ `nextExpenseDate`, `childExpenses`)
 *   POST   accounts/saveRecurringExpense              create (no `id`) / update, one endpoint
 *   DELETE accounts/deleteRecurringExpense/:id        refused server-side once child expenses exist
 *
 * The list endpoint ignores `filter.fromDate` / `toDate` (legacy sent them anyway), so no date filter is offered.
 */
@Injectable({ providedIn: 'root' })
export class RecurringExpensesService {
  private api = inject(ApiService);

  /** Paged list: `{ list, count, pageCount, startIndex, lastIndex }`. */
  async getList(param: any): Promise<any> {
    const d = (await this.api.request<any>(this.api.post('accounts/getRecurringExpenseList', param)))?.data;
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list ?? [], count: d.count ?? 0, pageCount: d.pageCount ?? 0, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  /** The record for editing; `null` when the id does not resolve. */
  async getById(id: string): Promise<RecurringExpense | null> {
    const raw = (await this.api.request<any>(this.api.get('accounts/getRecurringExpenseById/' + id)))?.data;
    if (!raw?.id) return null;
    const r = new RecurringExpense();
    r.ParseJson(raw);
    return r;
  }

  /** The read-only payload; the repo answers `{}` for an unknown id. */
  async getOverview(id: string): Promise<RecurringExpense | null> {
    const raw = (await this.api.request<any>(this.api.get('accounts/getRecurringExpenseOverview/' + id)))?.data;
    if (!raw?.id) return null;
    const r = new RecurringExpense();
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
      return await this.api.request(this.api.post('accounts/saveRecurringExpense', info));
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  delete = (id: string) => this.api.request(this.api.delete('accounts/deleteRecurringExpense/' + id));
}
