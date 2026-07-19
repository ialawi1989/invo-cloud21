import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

export interface CategoryTranslation {
  name?: Record<string, string>;
  [key: string]: unknown;
}

export interface CategoryMediaUrl {
  defaultUrl?: string;
  thumbnailUrl?: string;
}

/** A product assigned to a category. `index` drives the saved order. */
export interface CategoryProduct {
  id: string;
  name: string;
  barcode?: string;
  thumbnailUrl?: string | null;
  index: number;
}

/** Full category record (get-one / save). */
export interface Category {
  /** `null` on create. */
  id: string | null;
  name: string;
  departmentId: string | null;
  mediaId: string | null;
  mediaUrl?: CategoryMediaUrl;
  translation?: CategoryTranslation;
  index?: number;
  [key: string]: unknown;
}

export interface CategoryListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
  departmentId?: string;
}

export interface CategoryListRow {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  index: number;
}

export interface CategoryListResult {
  list: CategoryListRow[];
  count: number;
  pageCount: number;
}

/** CategoryService — wraps the legacy `product/*Category*` endpoints. */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private api = inject(ApiService);

  async getList(params: CategoryListParams = {}): Promise<CategoryListResult> {
    const body: Record<string, unknown> = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    if (params.departmentId) body['departmentId'] = params.departmentId;
    const res = await this.api.request<any>(this.api.post('product/getCategoryList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: CategoryListRow[] = raw.map((c, i) => ({
      id: String(c?.id ?? ''),
      name: String(c?.name ?? ''),
      thumbnailUrl: c?.mediaUrl?.thumbnailUrl ?? c?.mediaUrl?.defaultUrl ?? null,
      index: typeof c?.index === 'number' ? c.index : i,
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  async getOne(id: string): Promise<Category | null> {
    const res = await this.api.request<any>(this.api.get(`product/getCategory/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return {
      id: String(raw?.id ?? ''),
      name: String(raw?.name ?? ''),
      departmentId: raw?.departmentId != null ? String(raw.departmentId) : null,
      mediaId: raw?.mediaId != null ? String(raw.mediaId) : null,
      mediaUrl: raw?.mediaUrl ?? undefined,
      translation: (raw?.translation && typeof raw.translation === 'object') ? { ...raw.translation } : undefined,
      index: typeof raw?.index === 'number' ? raw.index : undefined,
      ...raw,
    };
  }

  async save(payload: Partial<Category>): Promise<{ success: boolean; data?: any }> {
    const res = await this.api.request<any>(this.api.post('product/saveCategory', payload));
    return { success: !!res?.success, data: res?.data };
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(this.api.delete(`product/deleteCategory/${id}`));
    return { success: !!res?.success };
  }

  /** Persist a new category order — `[{ id, index }]`. */
  async rearrange(order: { id: string; index: number }[]): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(this.api.post('product/rearrangeCategories', order));
    return { success: !!res?.success };
  }

  // ── Assigned products ───────────────────────────────────────────────────────
  // Unlike brands (whose products ride along in the category payload), category
  // assignments are a separate resource: loaded and saved through their own
  // endpoints, so the form saves the category first and the products second.

  /** Products currently assigned to this category. */
  async getCategoryProducts(categoryId: string): Promise<CategoryProduct[]> {
    const res = await this.api.request<any>(this.api.get(`product/getCategoryProducts/${categoryId}`));
    const raw: any[] = Array.isArray(res?.data) ? res.data : (res?.data?.list ?? []);
    return raw.map((p, i) => this.mapProduct(p, i));
  }

  /**
   * Products not yet in any category — the pool the picker offers. A product
   * belongs to at most one category, so offering categorised ones would let
   * the user silently move them.
   */
  async getUncategorizedProducts(params: {
    page?: number; limit?: number; searchTerm?: string;
  } = {}): Promise<{ list: CategoryProduct[]; count: number; pageCount: number }> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      searchTerm: params.searchTerm ?? '',
      sortBy: {},
    };
    // Legacy endpoint name, typo and all — 'Catigorized'.
    const res = await this.api.request<any>(this.api.post('product/getNonCatigorizedProductList', body));
    const raw: any[] = res?.data?.list ?? [];
    return {
      list: raw.map((p, i) => this.mapProduct(p, i)),
      count: Number(res?.data?.count ?? raw.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  /** Replace this category's product assignments. */
  async saveCategoryProducts(categoryId: string, products: CategoryProduct[]): Promise<{ success: boolean }> {
    const body = {
      id: categoryId,
      // Re-index on the way out so the saved order matches what's on screen.
      options: products.map((p, i) => ({ ...p, index: i })),
    };
    const res = await this.api.request<any>(this.api.post('product/saveCategoryProducts', body));
    return { success: !!res?.success };
  }

  private mapProduct(p: any, fallbackIndex: number): CategoryProduct {
    return {
      id: String(p?.id ?? p?._id ?? ''),
      name: String(p?.name ?? ''),
      barcode: p?.barcode ?? '',
      thumbnailUrl: p?.mediaUrl?.thumbnailUrl ?? p?.image ?? p?.thumbnailUrl ?? null,
      index: typeof p?.index === 'number' ? p.index : fallbackIndex,
    };
  }
}
