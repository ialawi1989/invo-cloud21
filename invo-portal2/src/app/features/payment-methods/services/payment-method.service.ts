import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  PaymentAccount,
  PaymentMethod,
  PaymentMethodListParams,
  PaymentMethodListResponse,
  emptyPaymentMethod,
} from './payment-method.types';

/**
 * Wraps the legacy `accounts/*` payment-method endpoints:
 *
 *   POST accounts/getPaymentMethodList        → paginated list (Cash + Card)
 *   POST accounts/getOnlinePaymentMethods     → available online providers
 *   GET  accounts/getPaymentMethod/:id        → single read
 *   GET  accounts/getPaymentAccounts          → GL account picker rows
 *   POST accounts/savePaymentMethod           → upsert
 *   POST accounts/enablePaymentMethods        → flip the `isEnabled` flag
 *   POST accounts/rearrangePaymentMethod      → save the drag-reorder
 *
 * Wire format mirrors the legacy `PaymnetMethod` model verbatim
 * (typo intentional); we only normalise stringly-typed numbers and
 * missing arrays here.
 */
@Injectable({ providedIn: 'root' })
export class PaymentMethodService {
  private api = inject(ApiService);

  // ─── List ───────────────────────────────────────────────────────
  async getList(params: PaymentMethodListParams = {}): Promise<PaymentMethodListResponse> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 30,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy ?? {},
      ...(params.type ? { type: params.type } : {}),
    };
    const res = await this.api.request<any>(
      this.api.post('accounts/getPaymentMethodList/', body),
    );
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list:      list.map(this.normalize),
      count:     Number(data?.count ?? list.length) || 0,
      pageCount: Number(data?.pageCount ?? Math.ceil((data?.count ?? list.length) / (body.limit || 30))) || 1,
    };
  }

  /** Online providers the company is allowed to use (server filters
   *  by `companyData.country`). Returns the same shape as `getList`
   *  so the list page can reuse its row rendering. */
  async getOnlineList(params: PaymentMethodListParams = {}): Promise<PaymentMethodListResponse> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 100,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy ?? {},
    };
    const res = await this.api.request<any>(
      this.api.post('accounts/getOnlinePaymentMethods/', body),
    );
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list:      list.map(this.normalize),
      count:     Number(data?.count ?? list.length) || 0,
      pageCount: Number(data?.pageCount ?? 1) || 1,
    };
  }

  async getById(id: string): Promise<PaymentMethod | null> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getPaymentMethod/${id}`),
    );
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    return this.normalize(raw);
  }

  /** GL accounts available for linking. The legacy endpoint returns
   *  a flat array of `{ id, name, accountNumber }`. */
  async getAccounts(): Promise<PaymentAccount[]> {
    const res = await this.api.request<any>(
      this.api.get('accounts/getPaymentAccounts'),
    );
    const raw: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.list) ? res.data.list : []);
    return raw
      .map(a => ({
        id:   String(a?.id ?? a?._id ?? ''),
        name: String(a?.name ?? ''),
        code: a?.accountNumber ?? a?.code ?? undefined,
      }))
      .filter(a => a.id);
  }

  async save(m: PaymentMethod): Promise<{ id: string } | null> {
    const res = await this.api.request<any>(
      this.api.post('accounts/savePaymentMethod', m),
    );
    if (!res?.success) return null;
    const newId = res?.data?.id ?? m.id;
    return newId ? { id: String(newId) } : null;
  }

  /** Toggle the `isEnabled` flag without a full save. The legacy
   *  endpoint expects `{ paymentMethodId, isEnabled }`. */
  async setEnabled(id: string, isEnabled: boolean): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.post('accounts/enablePaymentMethods', {
        paymentMethodId: id,
        isEnabled,
      }),
    );
    return !!res?.success;
  }

  /** Persist a drag-reorder. Pass the methods in the new order; we
   *  send `{ id, index }` pairs (the legacy wire contract). */
  async reorder(methodsInOrder: PaymentMethod[]): Promise<boolean> {
    const payload = methodsInOrder.map((m, i) => ({ id: m.id, index: i }));
    const res = await this.api.request<any>(
      this.api.post('accounts/rearrangePaymentMethod', payload),
    );
    return !!res?.success;
  }

  /** Coerce server response into the canonical front-end shape.
   *  Numbers may arrive as strings, booleans as 0/1 flags, optional
   *  fields may be missing — normalise everything to the type's
   *  invariants so the rest of the front-end can trust the shape. */
  private normalize = (raw: any): PaymentMethod => {
    const base = emptyPaymentMethod();
    return {
      ...base,
      id:            String(raw?.id ?? ''),
      name:          String(raw?.name ?? ''),
      type:          raw?.type === 'Card' ? 'Card' : 'Cash',
      rate:          Number(raw?.rate ?? 1) || 1,
      country:       raw?.country ?? undefined,
      countries:     Array.isArray(raw?.countries) ? raw.countries.map(String) : undefined,
      symbol:        String(raw?.symbol ?? ''),
      bankCharge:    Number(raw?.bankCharge ?? 0) || 0,
      afterDecimal:  Number(raw?.afterDecimal ?? 3) || 0,
      accountId:     raw?.accountId   ? String(raw.accountId)   : null,
      accountName:   raw?.accountName ? String(raw.accountName) : null,
      index:         Number(raw?.index ?? 0) || 0,
      isEnabled:     !!raw?.isEnabled,
      pos:           raw?.pos           !== false,
      showInAccount: raw?.showInAccount !== false,
      options: {
        OpenDrawer: !!raw?.options?.OpenDrawer,
        ReqCode:    !!raw?.options?.ReqCode,
      },
      mediaUrl: raw?.mediaUrl && typeof raw.mediaUrl === 'object'
        ? { defaultUrl: raw.mediaUrl.defaultUrl, thumbnailUrl: raw.mediaUrl.thumbnailUrl }
        : null,
      mediaId:        raw?.mediaId ? String(raw.mediaId) : null,
      settings:       (raw?.settings && typeof raw.settings === 'object') ? raw.settings : {},
      // The legacy page hard-codes the lowercase string check.
      isDefaultCash:  typeof raw?.name === 'string' && raw.name.trim().toLowerCase() === 'default cash',
      accountBalance: raw?.accountBalance ?? undefined,
      updatedDate:    raw?.updatedDate    ?? undefined,
    };
  };
}
