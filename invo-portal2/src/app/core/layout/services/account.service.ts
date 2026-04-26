import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../../http';

/**
 * Minimal Account shape used by pickers throughout the app. The backend's
 * Account entity has many more fields (balances, opening balances, etc.) —
 * this mini shape covers everything product-form's purchase/sale selectors
 * need, plus translation helpers.
 */
export interface AccountMini {
  id:         string;
  name:       string;
  /**
   * Backend category used for grouping in the dropdown
   * (e.g. 'Current Assets', 'Income', 'Cost of Goods Sold').
   */
  parentType?: string;
}

/**
 * Company-wide chart-of-accounts lookup. Two lists — purchase-side and
 * sales-side — are cached independently because the backend exposes them
 * via separate endpoints (`accounts/getPurchaseAccounts` and
 * `accounts/getSalesAccounts`). Each endpoint returns the accounts that
 * are eligible targets for that kind of product (e.g. Inventory Assets,
 * Cost of Goods Sold for purchase; Sales, Service Revenue for sales).
 *
 * Load-once per session; concurrent callers share the in-flight promise.
 * Follows the same pattern as `BranchConnectionService` / `ServiceListService`.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private api = inject(ApiService);

  purchaseAccounts = signal<AccountMini[]>([]);
  saleAccounts     = signal<AccountMini[]>([]);
  purchaseLoaded   = signal<boolean>(false);
  saleLoaded       = signal<boolean>(false);

  private purchasePending: Promise<AccountMini[]> | null = null;
  private salePending:     Promise<AccountMini[]> | null = null;

  async loadPurchaseAccounts(force = false): Promise<AccountMini[]> {
    if (this.purchaseLoaded() && !force) return this.purchaseAccounts();
    if (this.purchasePending) return this.purchasePending;

    this.purchasePending = (async () => {
      try {
        const res = await this.api.request<any>(this.api.get('accounts/getPurchaseAccounts'));
        const list = this.mapList(res);
        this.purchaseAccounts.set(list);
        return list;
      } catch {
        this.purchaseAccounts.set([]);
        return [];
      } finally {
        this.purchaseLoaded.set(true);
        this.purchasePending = null;
      }
    })();
    return this.purchasePending;
  }

  async loadSaleAccounts(force = false): Promise<AccountMini[]> {
    if (this.saleLoaded() && !force) return this.saleAccounts();
    if (this.salePending) return this.salePending;

    this.salePending = (async () => {
      try {
        const res = await this.api.request<any>(this.api.get('accounts/getSalesAccounts'));
        const list = this.mapList(res);
        this.saleAccounts.set(list);
        return list;
      } catch {
        this.saleAccounts.set([]);
        return [];
      } finally {
        this.saleLoaded.set(true);
        this.salePending = null;
      }
    })();
    return this.salePending;
  }

  /**
   * Group a flat list by parentType — the shape `<optgroup>` and the old
   * ng-select `[groupBy]="parentType"` both expect. Preserves insertion
   * order so the first parentType seen comes first in the rendered list.
   */
  groupByParentType(list: AccountMini[]): Array<{ parentType: string; items: AccountMini[] }> {
    const bucket = new Map<string, AccountMini[]>();
    for (const a of list) {
      const key = a.parentType ?? '';
      const arr = bucket.get(key) ?? [];
      arr.push(a);
      bucket.set(key, arr);
    }
    return Array.from(bucket.entries()).map(([parentType, items]) => ({ parentType, items }));
  }

  private mapList(res: any): AccountMini[] {
    // Endpoints return either { data: Account[] } or { data: { list: Account[] } }
    // depending on the specific controller — normalise both shapes.
    const raw: any[] =
      res?.data?.list ?? (Array.isArray(res?.data) ? res.data : []) ?? [];
    return raw.map((a: any) => ({
      id:         a.id ?? a._id ?? '',
      name:       a.name ?? '',
      parentType: a.parentType ?? '',
    }));
  }
}
