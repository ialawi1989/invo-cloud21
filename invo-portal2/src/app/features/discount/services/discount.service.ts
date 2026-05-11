import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  Discount,
  DiscountListParams,
  DiscountListResponse,
  emptyDiscount,
} from './discount.types';

/** Rich snapshot of an `items` row returned by `getDiscount` —
 *  superset of the picker's `ProductOption` / `CategoryOption` so
 *  the form can warm either cache from the same shape. */
export interface DiscountItemRef {
  id:            string;
  name:          string;
  image?:        string;
  type?:         string;
  defaultPrice?: number;
  barcode?:      string;
  categoryName?: string;
}

/**
 * Wraps the legacy `accounts/*` discount endpoints:
 *
 *   POST accounts/getDiscountList   → paginated list
 *   GET  accounts/getDiscount/:id   → single read
 *   POST accounts/saveDiscount      → upsert
 *
 * Wire format matches the legacy `Discount` model verbatim; we
 * only normalise stringly-typed numbers and missing arrays here.
 */
@Injectable({ providedIn: 'root' })
export class DiscountService {
  private api = inject(ApiService);

  async getList(params: DiscountListParams = {}): Promise<DiscountListResponse> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy ?? {},
    };
    const res = await this.api.request<any>(
      this.api.post('accounts/getDiscountList', body),
    );
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list:      list.map(this.normalize),
      count:     Number(data?.count ?? list.length) || 0,
      pageCount: Number(data?.pageCount ?? Math.ceil((data?.count ?? list.length) / (body.limit || 15))) || 1,
    };
  }

  async getById(id: string): Promise<{
    discount:    Discount;
    /** Inline snapshots for any selections the server returned as
     *  full objects rather than bare ids — lets the form warm its
     *  picker caches so saved selections render with real names
     *  (and images / chips for products) on first paint. Empty when
     *  the server returned only ids. */
    selections: {
      items:     DiscountItemRef[];
      branches:  { id: string; name: string }[];
      employees: { id: string; name: string }[];
    };
  } | null> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getDiscount/${id}`),
    );
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    return {
      discount: this.normalize(raw),
      selections: {
        items:     this.toItemRefs(raw?.items),
        branches:  this.toNamedRefs(raw?.branches),
        employees: this.toNamedRefs(raw?.permittedEmployees),
      },
    };
  }

  /** Mirror of `toIdArray` that keeps `{id, name}` rather than just
   *  the id. Skips entries the server returned as bare strings
   *  (there's no name to harvest there). */
  private toNamedRefs(raw: any): { id: string; name: string }[] {
    if (!Array.isArray(raw)) return [];
    const out: { id: string; name: string }[] = [];
    for (const v of raw) {
      if (v && typeof v === 'object') {
        const id = v?.id ?? v?._id;
        if (!id) continue;
        const name = this.flattenName(v);
        if (name) out.push({ id: String(id), name });
      }
    }
    return out;
  }

  /** Richer variant of `toNamedRefs` for `items` — extracts the
   *  product / category fields the GET endpoint returns alongside
   *  the id (image thumbnail, type, default price, category) so
   *  the selected-items cards render the same chips you see in
   *  the picker without a follow-up request. */
  private toItemRefs(raw: any): DiscountItemRef[] {
    if (!Array.isArray(raw)) return [];
    const out: DiscountItemRef[] = [];
    for (const v of raw) {
      if (!v || typeof v !== 'object') continue;
      const id = v?.id ?? v?._id;
      if (!id) continue;
      out.push({
        id:           String(id),
        name:         this.flattenName(v) || String(id),
        // The SQL returns `mediaUrl` as `{ thumbnailUrl: '...' }` or
        // `null`. Flatten it to a plain URL string for the form.
        image:        typeof v?.mediaUrl?.thumbnailUrl === 'string'
                        ? v.mediaUrl.thumbnailUrl
                        : (typeof v?.mediaUrl === 'string' ? v.mediaUrl : undefined),
        type:         v?.type ?? undefined,
        defaultPrice: typeof v?.defaultPrice === 'number'
                        ? v.defaultPrice
                        : (v?.defaultPrice != null && Number.isFinite(Number(v.defaultPrice))
                            ? Number(v.defaultPrice)
                            : undefined),
        barcode:      v?.barcode ?? undefined,
        categoryName: typeof v?.categoryName === 'string' ? v.categoryName : undefined,
      });
    }
    return out;
  }

  /** Name-uniqueness check — wraps the shared `company/validateName`
   *  endpoint with the discount table name pre-filled. Pass the
   *  current row id so editing a row's own name doesn't flag itself
   *  as a duplicate. Returns `true` when the name is free. */
  async isNameAvailable(name: string, id?: string | null): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.post('company/validateName', {
        tableName: 'discount',
        id:        id ?? '',
        name,
        branchId:  '',
      }),
    );
    return !!res?.success;
  }

  /** Paginated category list — wraps `product/getCategoryList`.
   *  Lives here so the discount form doesn't need to import
   *  `ProductListService` for a single endpoint; the shape it returns
   *  matches `loadEmployeesPage` for consistency. */
  async loadCategoriesPage(
    params: { page: number; limit: number; searchTerm?: string },
  ): Promise<{ list: { id: string; name: string }[]; count: number }> {
    const res = await this.api.request<any>(
      this.api.post('product/getCategoryList', {
        page:       params.page,
        limit:      params.limit,
        searchTerm: params.searchTerm ?? '',
        sortBy:     {},
      }),
    );
    const data = res?.data ?? {};
    const raw: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list: raw
        .map(c => ({
          id:   String(c?.id ?? c?._id ?? ''),
          // `name` may arrive as a translation object — prefer the
          // pre-resolved `displayName` field, otherwise pick the
          // first non-empty string from the map. Same defence as the
          // product loader in the form component.
          name: this.flattenName(c),
        }))
        .filter(c => c.id),
      count: Number(data?.count ?? raw.length) || 0,
    };
  }

  /** Normalise a server array that may be either `string[]` or
   *  `{id, ...}[]` (the discount endpoint mixes both shapes across
   *  callers). Drops empty/invalid entries. */
  private toIdArray(raw: any): string[] {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const v of raw) {
      if (typeof v === 'string') {
        if (v.trim()) out.push(v);
      } else if (v && typeof v === 'object') {
        const id = v?.id ?? v?._id;
        if (id) out.push(String(id));
      }
    }
    return out;
  }

  /** Pick a plain string out of a `name`/`displayName` field that
   *  may be either a plain string or a `{en, ar, …}` translation
   *  map. Returns `''` rather than `"[object Object]"` when the
   *  shape is unrecognised. */
  private flattenName(raw: any): string {
    const dn = raw?.displayName;
    if (typeof dn === 'string' && dn.trim()) return dn;
    const n = raw?.name;
    if (typeof n === 'string') return n;
    if (n && typeof n === 'object') {
      for (const v of Object.values(n)) {
        if (typeof v === 'string' && v.trim()) return v as string;
      }
    }
    return '';
  }

  /** Paginated employee list — wraps `employee/getEmployeeList`
   *  (singular `Employee`, matches the legacy backend route — the
   *  legacy service method name `getEmployeesList` is plural and
   *  was misleading). Lives here rather than a shared service
   *  because the discount form is the only consumer right now;
   *  lift to core when a second feature needs it. Returns
   *  lightweight `{ id, name }` rows since that's all the picker
   *  renders. */
  async loadEmployeesPage(
    params: {
      page: number;
      limit: number;
      searchTerm?: string;
      /** Already-selected employee ids — sent so the backend can pin
       *  them at the top of page 1 (the picker can show the saved
       *  selections without paginating to find them). */
      employees?: string[];
    },
  ): Promise<{ list: { id: string; name: string }[]; count: number }> {
    const res = await this.api.request<any>(
      this.api.post('employee/getEmployeeList', {
        page:       params.page,
        limit:      params.limit,
        searchTerm: params.searchTerm ?? '',
        sortBy:     {},
        employees:  params.employees ?? [],
      }),
    );
    const data = res?.data ?? {};
    const raw: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list: raw
        .map(e => ({
          id:   String(e?.id ?? ''),
          // `name` may arrive as a translation object — flatten it
          // before falling through to `fullName` / `email` as the
          // less-localised but still-string fallbacks. Same defence
          // as the category + product loaders.
          name: (this.flattenName(e) || String(e?.fullName ?? e?.email ?? '')).trim(),
        }))
        .filter(e => e.id),
      count: Number(data?.count ?? raw.length) || 0,
    };
  }

  async save(d: Discount): Promise<{ id: string } | null> {
    const res = await this.api.request<any>(
      this.api.post('accounts/saveDiscount', d),
    );
    if (!res?.success) return null;
    const newId = res?.data?.id ?? d.id;
    return newId ? { id: String(newId) } : null;
  }

  /** Coerce server response into the canonical front-end shape.
   *  Numbers may arrive as strings, booleans as 0/1 flags, arrays
   *  may be missing — normalise everything to the type's invariants
   *  so the rest of the front-end can trust the shape. */
  private normalize = (raw: any): Discount => {
    const base = emptyDiscount();
    return {
      ...base,
      id:                        String(raw?.id ?? ''),
      name:                      String(raw?.name ?? ''),
      amount:                    Number(raw?.amount ?? 0) || 0,
      percentage:                !!raw?.percentage,
      type:                      raw?.type === 'automatic' ? 'automatic' : 'manual',
      applyTo:                   raw?.applyTo === 'category' ? 'category' : 'product',
      // The server is inconsistent: some payloads return these as
      // bare id strings, others return them as full object snapshots
      // (`{ id, name, ... }`). `String(obj)` turns the latter into
      // `"[object Object]"` and breaks the picker — extract the id
      // when we see an object.
      items:                     this.toIdArray(raw?.items),
      branches:                  this.toIdArray(raw?.branches),
      minProductQty:             Number(raw?.minProductQty ?? 0) || 0,
      taxId:                     raw?.taxId ? String(raw.taxId) : null,
      quantityBasedCashDiscount: !!raw?.quantityBasedCashDiscount,
      available:                 raw?.available        !== false,
      availableOnline:           raw?.availableOnline  !== false,
      startDate:                 raw?.startDate    ?? null,
      expireDate:                raw?.expireDate   ?? null,
      startAtTime:               raw?.startAtTime  ?? null,
      expireAtTime:              raw?.expireAtTime ?? null,
      permittedEmployees:        this.toIdArray(raw?.permittedEmployees),
    };
  };
}
