import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { Expense, ExpenseLine } from '../../models/expense.model';

const nullIfBlank = <T>(v: T): T | null => ((v as unknown) === '' ? null : v);
const pad = (n: number) => String(n).padStart(2, '0');
/** `yyyy-MM-dd HH:mm` in local time - the shape legacy's date-time picker produced. */
const stamp = (v: any): any => {
  if (!(v instanceof Date)) return v;
  return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}`;
};

/**
 * Expenses API - the endpoints of the legacy `ExpenseService` (same paths, verbs, payloads). Reads unwrap the
 * envelope to `data`; the save returns the raw `{success,msg,data}` body and, like legacy, resolves the
 * server's error body on HTTP failure so callers can show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  private async data<T = any>(req: ReturnType<ApiService['get']>): Promise<T> {
    return (await this.api.request(req))?.data as T;
  }

  private async envelope(req: ReturnType<ApiService['get']>): Promise<any> {
    try {
      return await this.api.request(req);
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  private get lang(): string {
    return this.translate.currentLang || this.translate.defaultLang || '';
  }

  /** Paged list: `{ list, count, pageCount, startIndex, lastIndex }`. */
  async getExpenseList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getExpenseList', param));
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  async getExpense(id: string): Promise<Expense> {
    const e = new Expense();
    e.ParseJson(await this.data(this.api.get('accounts/getExpense/' + id)));
    return e;
  }

  async getExpenseNumber(): Promise<string> {
    return (await this.data<any>(this.api.get('accounts/getExpenseNumber/')))?.expenseNumber ?? '';
  }

  /** Accounts an expense line can be posted to. */
  getExpenseAccounts = async (): Promise<any[]> => (await this.data<any[]>(this.api.get('accounts/getExpenseAccounts'))) ?? [];

  toPayload(e: Expense): any {
    const lines = (e.lines as ExpenseLine[])
      .filter(l => !(l as any).isDeleted && (!!l.accountId || l.price > 0))
      .map((l, i) => ({
        id: nullIfBlank(l.id),
        expenseId: nullIfBlank(l.expenseId),
        accountId: nullIfBlank(l.accountId),
        amount: l.amount,
        taxId: nullIfBlank(l.taxId),
        taxes: l.taxes,
        taxType: l.taxType,
        taxPercentage: l.taxPercentage,
        taxTotal: l.taxTotal,
        total: l.total,
        isInclusiveTax: e.isInclusiveTax,
        note: l.note,
        isNew: false,
        index: i,
      }));
    return {
      id: nullIfBlank(e.id),
      expenseNumber: e.expenseNumber,
      expenseDate: stamp(e.expenseDate),
      referenceNumber: e.referenceNumber,
      supplierId: nullIfBlank(e.supplierId),
      customerId: nullIfBlank(e.customerId),
      branchId: nullIfBlank(e.branchId),
      paymentMethodId: nullIfBlank(e.paymentMethodId),
      note: e.note,
      description: e.description,
      isInclusiveTax: e.isInclusiveTax,
      total: e.total,
      smallestCurrency: e.smallestCurrency,
      roundingType: e.roundingType,
      roundingTotal: e.roundingTotal,
      attachment: e.attachment,
      customFields: e.customFields,
      lines,
    };
  }

  saveExpense(e: Expense): Promise<any> {
    return this.envelope(this.api.post('accounts/saveExpense', this.toPayload(e)));
  }

  deleteExpense = (id: string) => this.api.request(this.api.delete('accounts/deleteExpense/' + id));
  sendExpenseEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendExpenseEmail/', param));
  viewExpensePdf = (id: string) => this.data(this.api.get('accounts/viewExpensePdf/' + id, this.lang ? { lang: this.lang } : undefined));
}
