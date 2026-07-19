import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

export interface BrandTranslation {
  name?: Record<string, string>;
  [key: string]: unknown;
}

/** A product assigned to a brand. `index` drives the saved order. */
export interface BrandProduct {
  id: string;
  name: string;
  barcode?: string;
  thumbnailUrl?: string | null;
  index: number;
}

/** Full brand record (get-one / save). */
export interface Brand {
  /** `null` on create. */
  id: string | null;
  name: string;
  translation?: BrandTranslation;
  /** Products assigned to the brand. Posted back inside the save payload. */
  options?: BrandProduct[];
  [key: string]: unknown;
}

export interface BrandListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface BrandListRow {
  id: string;
  name: string;
}

export interface BrandListResult {
  list: BrandListRow[];
  count: number;
  pageCount: number;
}

/**
 * BrandService — wraps the legacy `product/*Brand*` endpoints. Brands cannot be
 * deleted in this app (no delete route exists); the list offers Edit only.
 */
@Injectable({ providedIn: 'root' })
export class BrandService {
  private api = inject(ApiService);

  async getList(params: BrandListParams = {}): Promise<BrandListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getBrandList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: BrandListRow[] = raw.map((b) => ({
      id: String(b?.id ?? ''),
      name: String(b?.name ?? ''),
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  async getOne(id: string): Promise<Brand | null> {
    const res = await this.api.request<any>(this.api.get(`product/getBrand/${id}`));
    // `getBrand` returns an array — read the first row.
    const raw = Array.isArray(res?.data) ? res.data[0] : res?.data;
    if (!raw) return null;
    return {
      id: String(raw?.id ?? ''),
      name: String(raw?.name ?? ''),
      translation: (raw?.translation && typeof raw.translation === 'object') ? { ...raw.translation } : undefined,
      options: Array.isArray(raw?.options) ? raw.options.map((o: any, i: number) => this.mapProduct(o, i)) : [],
      ...raw,
    };
  }

  /** Create (id empty/null) or update — posts to `saveNewBrand`. */
  async save(payload: Partial<Brand>): Promise<{ success: boolean; data?: any }> {
    const body = {
      ...payload,
      // Re-index on the way out so the saved order matches what's on screen.
      options: (payload.options ?? []).map((p, i) => ({ ...p, index: i })),
    };
    const res = await this.api.request<any>(this.api.post('product/saveNewBrand', body));
    return { success: !!res?.success, data: res?.data };
  }

  /**
   * Products not yet assigned to any brand — the pool the picker offers.
   * When editing, `brandId` also brings back this brand's own products so
   * they aren't silently missing from the list.
   */
  async getUnbrandedProducts(params: {
    page?: number; limit?: number; searchTerm?: string; brandId?: string | null;
  } = {}): Promise<{ list: BrandProduct[]; count: number; pageCount: number }> {
    const body: Record<string, unknown> = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      searchTerm: params.searchTerm ?? '',
      sortBy: {},
    };
    if (params.brandId) body['filter'] = { brandId: params.brandId };

    const res = await this.api.request<any>(this.api.post('product/getNonBrandedProductList', body));
    const raw: any[] = res?.data?.list ?? [];
    return {
      list: raw.map((p, i) => this.mapProduct(p, i)),
      count: Number(res?.data?.count ?? raw.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  private mapProduct(p: any, fallbackIndex: number): BrandProduct {
    return {
      id: String(p?.id ?? p?._id ?? ''),
      name: String(p?.name ?? ''),
      barcode: p?.barcode ?? '',
      thumbnailUrl: p?.mediaUrl?.thumbnailUrl ?? p?.image ?? p?.thumbnailUrl ?? null,
      index: typeof p?.index === 'number' ? p.index : fallbackIndex,
    };
  }
}
