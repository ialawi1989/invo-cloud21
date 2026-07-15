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
}
