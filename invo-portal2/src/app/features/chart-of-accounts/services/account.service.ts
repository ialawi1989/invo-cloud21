import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import {
  Account,
  AccountListParams,
  AccountListResponse,
  emptyAccount,
} from './account.types';
import { findAccountType } from '../utils/account-types';

/**
 * Wraps the legacy `accounts/*` Chart-of-Accounts endpoints:
 *
 *   POST accounts/getAccounts                  → paginated list
 *   GET  accounts/getAccount/:id               → single read
 *   POST accounts/getParentAccountListByType   → parent picker rows
 *   POST accounts/saveAccount                  → upsert
 *   DELETE accounts/deleteAccount/:id          → remove
 *
 * Same backend the payment-methods feature already calls into for
 * `getPaymentAccounts` / `saveAccount`.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private api = inject(ApiService);

  // ─── List ───────────────────────────────────────────────────────
  async getList(params: AccountListParams = {}): Promise<AccountListResponse> {
    const body: Record<string, unknown> = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 30,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy ?? {},
    };
    // Legacy expects `filter.parentType: string[]` when a filter is
    // active. Skip the key entirely when empty so the server doesn't
    // mis-interpret an empty array as "match nothing".
    if (params.parentType?.length) {
      body['filter'] = { parentType: params.parentType };
    }
    // Mirror the product-list behaviour — when the user has toggled
    // columns on/off via the customise-columns drawer, send only
    // the visible keys so the backend can project a tighter payload.
    if (params.columns?.length) {
      body['columns'] = params.columns;
    }

    const res = await this.api.request<any>(
      this.api.post('accounts/getAccounts/', body),
    );
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list:      list.map(this.normalize),
      count:     Number(data?.count ?? list.length) || 0,
      pageCount: Number(data?.pageCount ?? 1) || 1,
    };
  }

  async getById(id: string): Promise<Account | null> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getAccount/${id}`),
    );
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    return this.normalize(raw);
  }

  /** Sub-accounts whose `type` matches the given type. Used by the
   *  form's "Parent account" dropdown — the legacy filters parent
   *  candidates by the new account's type. */
  async getParentsByType(type: string): Promise<Account[]> {
    if (!type) return [];
    const res = await this.api.request<any>(
      this.api.post('accounts/getParentAccountListByType', { type }),
    );
    const raw = res?.data?.list ?? res?.data ?? [];
    if (!Array.isArray(raw)) return [];
    return raw.map(this.normalize);
  }

  async save(a: Account): Promise<{ id: string } | null> {
    // Derive `parentType` from the static registry so consumers don't
    // have to set it. If the user typed a custom type (legacy data),
    // round-trip whatever was there.
    const payload: Account = {
      ...a,
      parentType: a.parentType || findAccountType(a.type)?.parentType || a.type,
    };
    const res = await this.api.request<any>(
      this.api.post('accounts/saveAccount', payload),
    );
    if (!res?.success) return null;
    const newId = res?.data?.id ?? a.id;
    return newId ? { id: String(newId) } : null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.delete(`accounts/deleteAccount/${id}`),
    );
    return !!res?.success;
  }

  /** Normalise a wire row into the canonical front-end shape.
   *  Coerces stringly-typed booleans/numbers, fills missing fields
   *  with empty-equivalent defaults so the rest of the app can trust
   *  the type. */
  private normalize = (raw: any): Account => {
    const base = emptyAccount();
    return {
      ...base,
      id:          String(raw?.id ?? ''),
      name:        String(raw?.name ?? ''),
      type:        String(raw?.type ?? ''),
      parentType:  String(raw?.parentType ?? findAccountType(raw?.type)?.parentType ?? ''),
      code:        raw?.code ? String(raw.code) : '',
      description: raw?.description ? String(raw.description) : '',
      parentId:    raw?.parentId ? String(raw.parentId) : null,
      default:     !!raw?.default,
      hasChild:    !!raw?.hasChild,
      translation: (raw?.translation && typeof raw.translation === 'object')
        ? {
            name:        raw.translation?.name        ?? undefined,
            description: raw.translation?.description ?? undefined,
          }
        : undefined,
    };
  };
}
