import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import {
  Service,
  ServiceListParams,
  ServiceListResponse,
  ServiceType,
  BranchServiceModel,
  SurchargeOption,
  PriceLabelOption,
  MenuOption,
  emptyImage,
  emptyOptions,
  emptyService,
} from './service.types';

/**
 * Wraps the legacy `branch/*` service-management endpoints:
 *
 *   POST  branch/getServicList        → paginated list (typo intentional)
 *   GET   branch/getService/:id       → single read
 *   POST  branch/saveService          → upsert
 *   DEL   branch/deleteService/:id    → remove
 *   POST  branch/arrangeServices      → save the drag-reorder
 *
 * Wire format mirrors the legacy `Service` / `BranchServiceModel`
 * classes verbatim; this layer only normalises stringly-typed
 * primitives, missing arrays, and the `mediaUrl` / `options` shape.
 */
@Injectable({ providedIn: 'root' })
export class ServiceManagementService {
  private api = inject(ApiService);

  // ─── List ───────────────────────────────────────────────────────
  async getList(params: ServiceListParams = {}): Promise<ServiceListResponse> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 30,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy ?? {},
    };
    const res = await this.api.request<any>(
      this.api.post('branch/getServicList', body),
    );
    const data = res?.data ?? {};
    // Legacy returns either `{ list, count, … }` (paged) or a bare
    // array (unpaged). Normalise both to the paged shape.
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    return {
      list:       list.map(this.normalize),
      count:      Number(data?.count ?? list.length) || 0,
      pageCount:  Number(data?.pageCount ?? Math.ceil((data?.count ?? list.length) / (body.limit || 30))) || 1,
      startIndex: Number(data?.startIndex ?? 0) || 0,
      lastIndex:  Number(data?.lastIndex  ?? list.length) || 0,
    };
  }

  async getById(id: string): Promise<Service | null> {
    const res = await this.api.request<any>(
      this.api.get(`branch/getService/${id}`),
    );
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return this.normalize(raw);
  }

  async save(s: Service): Promise<{ id: string } | null> {
    const res = await this.api.request<any>(
      this.api.post('branch/saveService', s),
    );
    if (!res?.success) return null;
    const newId = res?.data?.id ?? s.id;
    return newId ? { id: String(newId) } : null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.delete(`branch/deleteService/${id}`),
    );
    return !!res?.success;
  }

  /** Persist a drag-reorder. The backend `arrangeServices` handler
   *  iterates the rows and only reads `id` + `index` on each one,
   *  so we ship just those two fields. The payload is wrapped under
   *  `list` because the route middleware unwraps `req.body.list`
   *  before passing it to the handler (a bare array hits the
   *  `Cannot read properties of undefined (reading 'length')` error). */
  async reorder(orderedServices: Service[]): Promise<boolean> {
    const list = orderedServices.map((s, i) => ({ id: s.id, index: i }));
    const res = await this.api.request<any>(
      this.api.post('branch/arrangeServices', { list }),
    );
    return !!res?.success;
  }

  // ─── Dropdown source loaders ────────────────────────────────────
  // Endpoints mirror the legacy frontend service paths exactly —
  // the backend doesn't expose feature-aligned routes here:
  //   surcharges  → `accounts/getSurchargeList`
  //   priceLabels → `product/getPriceLabelList`
  //   menus       → `product/getMenuList`
  /** Surcharges for the per-branch "Charge" dropdown. */
  async getSurcharges(): Promise<SurchargeOption[]> {
    const res = await this.api.request<any>(
      this.api.post('accounts/getSurchargeList', { page: 1, limit: 999, searchTerm: '', sortBy: {} }),
    );
    const raw: any[] = Array.isArray(res?.data?.list) ? res.data.list : (Array.isArray(res?.data) ? res.data : []);
    return raw
      .map(r => ({
        id:     String(r?.id ?? ''),
        name:   String(r?.name ?? ''),
        symbol: r?.symbol ? String(r.symbol) : undefined,
      }))
      .filter(r => r.id);
  }

  /** Price labels for the per-branch "Price" dropdown. */
  async getPriceLabels(): Promise<PriceLabelOption[]> {
    const res = await this.api.request<any>(
      this.api.post('product/getPriceLabelList', { page: 1, limit: 999, searchTerm: '', sortBy: {} }),
    );
    const raw: any[] = Array.isArray(res?.data?.list) ? res.data.list : (Array.isArray(res?.data) ? res.data : []);
    return raw
      .map(r => ({ id: String(r?.id ?? ''), name: String(r?.name ?? '') }))
      .filter(r => r.id);
  }

  /** Menus for the form's "Default menu" dropdown. */
  async getMenus(searchTerm = ''): Promise<MenuOption[]> {
    const res = await this.api.request<any>(
      this.api.post('product/getMenuList', { page: 1, limit: 200, searchTerm, sortBy: {} }),
    );
    const raw: any[] = Array.isArray(res?.data?.list) ? res.data.list : (Array.isArray(res?.data) ? res.data : []);
    return raw
      .map(r => ({ id: String(r?.id ?? ''), name: String(r?.name ?? '') }))
      .filter(r => r.id);
  }

  // ─── Normalisers ────────────────────────────────────────────────
  /** Coerce a wire row into the canonical `Service` shape. Numbers
   *  may arrive as strings, optional fields may be missing, nested
   *  objects (mediaUrl/options) may be `null`. Normalise so the rest
   *  of the front-end can trust the shape. */
  private normalize = (raw: any): Service => {
    const base = emptyService();
    return {
      ...base,
      id:       String(raw?.id ?? ''),
      name:     String(raw?.name ?? ''),
      type:     this.normalizeType(raw?.type),
      index:    Number(raw?.index ?? 0) || 0,
      default:  !!raw?.default,
      menuId:   raw?.menuId ? String(raw.menuId) : '',
      mediaId:  raw?.mediaId ? String(raw.mediaId) : null,
      mediaUrl: raw?.mediaUrl && typeof raw.mediaUrl === 'object'
        ? {
            defaultUrl:   String(raw.mediaUrl.defaultUrl   ?? ''),
            thumbnailUrl: String(raw.mediaUrl.thumbnailUrl ?? ''),
          }
        : emptyImage(),
      options: raw?.options && typeof raw.options === 'object'
        ? {
            lockMenu:          !!raw.options.lockMenu,
            // Typo preserved verbatim — the backend reads this exact key.
            locKChangeService: !!raw.options.locKChangeService,
          }
        : emptyOptions(),
      branches: Array.isArray(raw?.branches)
        ? raw.branches.map((b: any): BranchServiceModel => ({
            branchId:     String(b?.branchId ?? ''),
            branchName:   String(b?.branchName ?? ''),
            priceLabelId: b?.priceLabelId ? String(b.priceLabelId) : '',
            chargeId:     b?.chargeId     ? String(b.chargeId)     : '',
            setting:      (b?.setting && typeof b.setting === 'object')
              ? { enabled: true, ...b.setting }
              : { enabled: true },
          }))
        : [],
      translation: (raw?.translation && typeof raw.translation === 'object')
        ? { name: raw.translation?.name ?? {} }
        : { name: {} },
      updatedDate: raw?.updatedDate ?? undefined,
    };
  };

  /** Coerce a raw type string back to the union. Empty string passes
   *  through so the form's "select a type" placeholder still shows
   *  for brand-new records. */
  private normalizeType(raw: unknown): ServiceType | '' {
    const known: ServiceType[] = ['DineIn', 'PickUp', 'Delivery', 'CarHop', 'Salon', 'Catering', 'Retail'];
    return typeof raw === 'string' && (known as string[]).includes(raw)
      ? (raw as ServiceType)
      : '';
  }
}
