import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/**
 * Accounting period lock. Documents dated before the last VAT payment / opening balance
 * date can't be edited (legacy `SharedAccountData.showAction` + `getTransactionDate`).
 */
@Injectable({ providedIn: 'root' })
export class TransactionLockService {
  private api = inject(ApiService);
  private cache: { vatPaymentDate?: string; openingBalanceDate?: string } | null | undefined;

  /** `company/transactionsDate` (optionally per branch). Cached for the default (all-branch) call. */
  async transactionsDate(branchId: string | null = null): Promise<any> {
    if (branchId === null && this.cache !== undefined) return this.cache;
    const data = (await this.api.request(this.api.post('company/transactionsDate', { branchId })))?.data ?? null;
    if (branchId === null) this.cache = data;
    return data;
  }

  /** True when `date` is after the lock date (or no lock exists). */
  isEditable(lock: { vatPaymentDate?: string } | null | undefined, date: any): boolean {
    return !(lock?.vatPaymentDate && new Date(lock.vatPaymentDate) > new Date(date));
  }

  invalidate(): void { this.cache = undefined; }
}
