import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** One ingredient row of a recipe (a reference to an inventory/kit product). */
export interface RecipeItem {
  /** Product id of the ingredient. */
  inventoryId: string;
  /** How many units of the ingredient this recipe consumes. */
  usage: number;
  // Display-only fields hydrated from the get-one response / picker.
  name?: string;
  unitCost?: number;
  UOM?: string;
  barcode?: string;
  defaultPrice?: number;
  type?: string;
  categoryName?: string;
  thumbnailUrl?: string;
}

export interface RecipeTranslation {
  name?: Record<string, string>;
  description?: Record<string, string>;
  [key: string]: unknown;
}

/** Full recipe record (get-one / save). */
export interface Recipe {
  /** `null` on create. */
  id: string | null;
  name: string;
  description: string;
  items: RecipeItem[];
  translation?: RecipeTranslation;
  [key: string]: unknown;
}

export interface RecipeListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface RecipeListRow {
  id: string;
  name: string;
}

export interface RecipeListResult {
  list: RecipeListRow[];
  count: number;
  pageCount: number;
}

/** RecipeService — wraps the legacy `product/*Recipe*` endpoints. */
@Injectable({ providedIn: 'root' })
export class RecipeService {
  private api = inject(ApiService);

  async getList(params: RecipeListParams = {}): Promise<RecipeListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getRecipeList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: RecipeListRow[] = raw.map((r) => ({
      id: String(r?.id ?? ''),
      name: String(r?.name ?? ''),
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  async getOne(id: string): Promise<Recipe | null> {
    const res = await this.api.request<any>(this.api.get(`product/getRecipe/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return {
      id: String(raw?.id ?? ''),
      name: String(raw?.name ?? ''),
      description: String(raw?.description ?? ''),
      items: Array.isArray(raw?.items) ? raw.items.map((i: any) => this.mapItem(i)) : [],
      translation: (raw?.translation && typeof raw.translation === 'object') ? { ...raw.translation } : undefined,
      ...raw,
    };
  }

  /** Create (id empty/null) or update. Items are sent as `{ inventoryId, usage }`. */
  async save(payload: Partial<Recipe>): Promise<{ success: boolean; data?: any }> {
    const body: Record<string, unknown> = {
      ...(payload ?? {}),
      items: (payload.items ?? []).map((i) => ({ inventoryId: i.inventoryId, usage: Number(i.usage) || 0 })),
    };
    const res = await this.api.request<any>(this.api.post('product/saveRecipe', body));
    return { success: !!res?.success, data: res?.data };
  }

  private mapItem(i: any): RecipeItem {
    return {
      inventoryId: String(i?.inventoryId ?? i?.id ?? ''),
      usage: Number(i?.usage) || 0,
      name: i?.name,
      unitCost: typeof i?.unitCost === 'number' ? i.unitCost : Number(i?.unitCost) || 0,
      UOM: i?.UOM,
      barcode: i?.barcode,
      defaultPrice: i?.defaultPrice,
      type: i?.type,
      categoryName: i?.categoryName,
      thumbnailUrl: i?.thumbnailUrl,
    };
  }
}
