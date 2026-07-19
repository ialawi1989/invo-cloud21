import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http/api.service';
import { environment } from '../../../../environments/environment';

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
  categoryName?: string;
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
  /** Branch ids this option is unavailable in — drives the availability grid. */
  excludedBranches: string[];
}

export interface OptionListResult {
  list: OptionListRow[];
  count: number;
  pageCount: number;
}

/** One option row shaped for the import endpoint. */
export interface OptionImportRow {
  name: string;
  displayName: string;
  kitchenName: string;
  isMultiple: boolean;
  isVisible: boolean;
  price: number;
  defaultPrice: number;
  translation: { name: Record<string, string> };
}

/** Per-option branch exclusions, as posted by the availability grid. */
export interface OptionAvailabilityChange {
  id: string;
  excludedBranches: string[];
}

/** OptionService — wraps the legacy `product/*Option*` endpoints. */
@Injectable({ providedIn: 'root' })
export class OptionService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

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
      excludedBranches: Array.isArray(o?.excludedBranches) ? o.excludedBranches.map(String) : [],
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

  // ─── Import / Export ──────────────────────────────────────────────────────

  /**
   * Bulk-import gate. The legacy contract is inverted: `success: true` means
   * **no** import is running, so it's safe to start one. `msg` explains the
   * job in flight when it isn't.
   */
  async getBulkImportProgress(): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.get('product/getOptionBulkImportProgress'));
    return { success: !!res?.success, msg: res?.msg };
  }

  async importOptions(rows: OptionImportRow[]): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('product/importOptions', rows));
    return { success: !!res?.success, msg: res?.msg };
  }

  /** Streams the export straight to a file download. */
  async exportOptions(type: 'csv' | 'xlsx'): Promise<void> {
    const response = await firstValueFrom(
      this.http.get(`${environment.backendUrl}product/exportOptions/${type}`, {
        responseType: 'blob',
        observe: 'response',
      }),
    );
    const blob = response.body;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `options.${type}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ─── Availability ─────────────────────────────────────────────────────────

  /** Save branch exclusions for the changed options only. */
  async setOptionAvailability(changes: OptionAvailabilityChange[]): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('product/setOptionAvailability', changes));
    return { success: !!res?.success, msg: res?.msg };
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
      categoryName: i?.categoryName,
      thumbnailUrl: i?.thumbnailUrl,
    };
  }
}
