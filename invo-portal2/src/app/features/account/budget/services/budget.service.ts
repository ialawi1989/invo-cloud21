import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { Budget, BudgetAccount, BudgetActualRow, BudgetListParams } from '../models/budget.model';

/**
 * Budget API - every endpoint of the legacy `BudgetService`, verified against InvoCloudBack
 * (`routes/v1/app/accounts.ts` -> `Budget.Controller` -> `Budget.repo`):
 *
 *   POST   accounts/getBudgetList            paged list `{ list, count, pageCount }` (sort only by a real column, e.g. `name`)
 *   GET    accounts/getBudget/:id            budget + its lines
 *   POST   accounts/saveBudget               create (no `id`) / update (`id`); an update changes the name and the lines only
 *   DELETE accounts/deleteBudget/:id         budget + lines
 *   GET    accounts/getAccountList           the accounts a budget can plan (P&L + balance-sheet parents)
 *   GET    accounts/ActualvsPrediction/:id   booked amounts and plan per account / period
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private api = inject(ApiService);

  private async data<T = any>(req: ReturnType<ApiService['get']>): Promise<T> {
    return (await this.api.request(req))?.data as T;
  }

  /** Mutation: the envelope on success, the server's error body on an HTTP failure (legacy behaviour). */
  private async envelope(req: ReturnType<ApiService['get']>): Promise<any> {
    try {
      return await this.api.request(req);
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  async getBudgetList(params: BudgetListParams): Promise<{ list: Budget[]; count: number; pageCount: number }> {
    const d = await this.data<any>(this.api.post('accounts/getBudgetList', params));
    const list = (d?.list ?? []).map((j: any) => { const b = new Budget(); b.ParseJson(j); return b; });
    return { list, count: Number(d?.count ?? list.length) || 0, pageCount: Number(d?.pageCount ?? 1) || 1 };
  }

  async getBudget(id: string): Promise<Budget> {
    const b = new Budget();
    b.ParseJson(await this.data(this.api.get('accounts/getBudget/' + id)));
    return b;
  }

  async getAccountList(): Promise<BudgetAccount[]> {
    return (await this.data<BudgetAccount[]>(this.api.get('accounts/getAccountList'))) ?? [];
  }

  async getActualVsPrediction(id: string): Promise<BudgetActualRow[]> {
    const rows = (await this.data<any[]>(this.api.get('accounts/ActualvsPrediction/' + id))) ?? [];
    return rows.map(r => ({ ...r, actualAmount: Number(r.actualAmount) || 0, prediction: Number(r.prediction) || 0 }));
  }

  saveBudget = (budget: Budget) => this.envelope(this.api.post('accounts/saveBudget', budget));
  deleteBudget = (id: string) => this.api.request(this.api.delete('accounts/deleteBudget/' + id));
}
