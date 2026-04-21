import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../../../core/http';

/** Lightweight supplier shape used in pickers / filters. */
export interface SupplierMini {
  id:   string;
  name: string;
}

/** Page result returned by `getMiniListPage()` — matches the shape expected
 *  by `SearchDropdownComponent`'s `loadFn`. */
export interface SupplierMiniPage {
  items:   SupplierMini[];
  hasMore: boolean;
}

/**
 * Supplier service — shared business entity used by purchase history filters,
 * bills, expenses, etc. Supports both:
 *
 *  • `loadMiniList()` — fetches the FULL list once and caches it (use for tiny
 *    deployments or when the caller already has the whole list cached).
 *  • `getMiniListPage({ page, limit, search })` — paginated + server-side
 *    search; ideal for `SearchDropdownComponent`'s `loadFn` (infinite scroll).
 */
@Injectable({ providedIn: 'root' })
export class SupplierService {
  private api = inject(ApiService);

  /** In-memory cache of the supplier mini list. Populated by `loadMiniList()`. */
  miniList = signal<SupplierMini[]>([]);
  loaded   = signal(false);

  /**
   * Fetches the full lightweight list once and caches it. Subsequent calls
   * resolve from cache unless `force` is true.
   */
  async loadMiniList(force = false): Promise<SupplierMini[]> {
    if (this.loaded() && !force) return this.miniList();

    const res = await this.api.request<any>(this.api.post('accounts/getSupplierMiniList', {}));
    const raw = res?.data?.list ?? res?.data ?? [];
    const list: SupplierMini[] = (Array.isArray(raw) ? raw : []).map((s: any) => this.mapRow(s));
    this.miniList.set(list);
    this.loaded.set(true);
    return list;
  }

  /**
   * Paginated + searchable page fetch. Hits `accounts/getSupplierMiniList`
   * with `{ page, limit, searchTerm }`. Returns the page and a `hasMore` flag
   * derived from the server's `pageCount`.
   */
  async getMiniListPage(params: {
    page:   number;
    limit:  number;
    search?: string;
  }): Promise<SupplierMiniPage> {
    const body: any = { page: params.page, limit: params.limit };
    const search = (params.search ?? '').trim();
    if (search) body.searchTerm = search;

    const res = await this.api.request<any>(this.api.post('accounts/getSupplierMiniList', body));
    const data = res?.data ?? {};
    const raw  = Array.isArray(data.list) ? data.list : (Array.isArray(data) ? data : []);
    const items: SupplierMini[] = raw.map((s: any) => this.mapRow(s));
    const pageCount = Number(data.pageCount ?? 1);
    return { items, hasMore: params.page < pageCount };
  }

  private mapRow(s: any): SupplierMini {
    return {
      id:   s.id   ?? s._id ?? '',
      name: s.name ?? s.supplierName ?? '',
    };
  }
}
