import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** One prep-recipe row of an option (an inventory product it consumes). */
export interface OptionRecipeItem {
  /** Ingredient product id (inventory). */
  inventoryId: string;
  /** How many units consumed. Legacy key is `usages` (plural). */
  usages: number;
  name?: string;
  unitCost?: number;
  UOM?: string;
  barcode?: string;
  type?: string;
  thumbnailUrl?: string;
}

export interface OptionTranslation {
  name?: Record<string, string>;
  displayName?: Record<string, string>;
  [key: string]: unknown;
}

/** Full option record (get-one / save). */
export interface Option {
  /** `null` on create. */
  id: string | null;
  name: string;
  displayName: string;
  kitchenName: string;
  price: number;
  isMultiple: boolean;
  isVisible: boolean;
  weight: number;
  mediaId: string | null;
  mediaUrl?: { defaultUrl?: string; thumbnailUrl?: string };
  recipe: OptionRecipeItem[];
  translation?: OptionTranslation;
  excludedBranches?: unknown[];
  [key: string]: unknown;
}

export interface OptionListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface OptionListRow {
  id: string;
  name: string;
  displayName: string;
  price: number;
  thumbnailUrl: string | null;
}

export interface OptionListResult {
  list: OptionListRow[];
  count: number;
  pageCount: number;
}

/** OptionService — wraps the legacy `product/*Option*` endpoints. */
@Injectable({ providedIn: 'root' })
export class OptionService {
  private api = inject(ApiService);

  async getList(params: OptionListParams = {}): Promise<OptionListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getOptionsList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: OptionListRow[] = raw.map((o) => ({
      id: String(o?.id ?? ''),
      name: String(o?.name ?? ''),
      displayName: String(o?.displayName ?? ''),
      price: Number(o?.price) || 0,
      thumbnailUrl: o?.thumbnailUrl ?? o?.mediaUrl?.thumbnailUrl ?? null,
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  async getOne(id: string): Promise<Option | null> {
    const res = await this.api.request<any>(this.api.get(`product/getOption/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return {
      id: String(raw?.id ?? ''),
      name: String(raw?.name ?? ''),
      displayName: String(raw?.displayName ?? ''),
      kitchenName: String(raw?.kitchenName ?? ''),
      price: Number(raw?.price) || 0,
      isMultiple: !!raw?.isMultiple,
      isVisible: raw?.isVisible !== false,
      weight: Number(raw?.weight) || 0,
      mediaId: raw?.mediaId != null ? String(raw.mediaId) : null,
      mediaUrl: raw?.mediaUrl ?? undefined,
      recipe: Array.isArray(raw?.recipe) ? raw.recipe.map((i: any) => this.mapItem(i)) : [],
      translation: (raw?.translation && typeof raw.translation === 'object') ? { ...raw.translation } : undefined,
      excludedBranches: Array.isArray(raw?.excludedBranches) ? raw.excludedBranches : [],
      ...raw,
    };
  }

  /** Create (id empty/null) or update. */
  async save(payload: Partial<Option>): Promise<{ success: boolean; data?: any }> {
    const body: Record<string, unknown> = {
      ...(payload ?? {}),
      recipe: (payload.recipe ?? []).map((i) => ({ inventoryId: i.inventoryId, usages: Number(i.usages) || 0 })),
    };
    const res = await this.api.request<any>(this.api.post('product/saveOption', body));
    return { success: !!res?.success, data: res?.data };
  }

  /** Soft delete (backend appends " [Deleted]"). */
  async delete(id: string): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(this.api.put(`product/deleteOption/${id}`, {}));
    return { success: !!res?.success };
  }

  private mapItem(i: any): OptionRecipeItem {
    return {
      inventoryId: String(i?.inventoryId ?? i?.recipeId ?? i?.id ?? ''),
      usages: Number(i?.usages) || 0,
      name: i?.name,
      unitCost: Number(i?.unitCost) || 0,
      UOM: i?.UOM,
      barcode: i?.barcode,
      type: i?.type,
      thumbnailUrl: i?.thumbnailUrl,
    };
  }
}
