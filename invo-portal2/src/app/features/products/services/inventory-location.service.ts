import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** Per-language overrides — `{ name: { en, ar, … } }`. */
export interface InventoryLocationTranslation {
  name?: Record<string, string>;
  [key: string]: unknown;
}

/** A product assigned to a location (id + display fields). */
export interface InventoryLocationProduct {
  id: string;
  name: string;
  barcode?: string;
  type?: string;
  /** Sent on save for a previously-assigned product the user removed — the
   *  backend clears that product's `locationId` for the branch. */
  isDeleted?: boolean;
  [key: string]: unknown;
}

/** Full location record (get-one / save round-trip). */
export interface InventoryLocation {
  /** `null` on create — backend assigns the id on save. */
  id: string | null;
  name: string;
  branchId: string | null;
  translation?: InventoryLocationTranslation;
  products: InventoryLocationProduct[];
  [key: string]: unknown;
}

export interface InventoryLocationListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
  branches?: string[];
}

export interface InventoryLocationListRow {
  id: string;
  name: string;
  branchName: string;
  translation?: InventoryLocationTranslation;
}

export interface InventoryLocationListResult {
  list: InventoryLocationListRow[];
  count: number;
  pageCount: number;
}

/**
 * InventoryLocationService — wraps the legacy `product/*InventoryLocations*`
 * endpoints (verified against InvoCloudBack `routes/v1/app/product.ts`).
 */
@Injectable({ providedIn: 'root' })
export class InventoryLocationService {
  private api = inject(ApiService);

  /** `product/getInventoryLocationsList` — body `{page,limit,searchTerm,sortBy,filter:{branches}}`. */
  async getList(params: InventoryLocationListParams = {}): Promise<InventoryLocationListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
      filter: { branches: params.branches ?? [] },
    };
    const res = await this.api.request<any>(this.api.post('product/getInventoryLocationsList', body));
    const raw: any[] = res?.data?.list ?? [];
    const list: InventoryLocationListRow[] = raw.map((l) => ({
      id: String(l?.id ?? ''),
      name: String(l?.name ?? ''),
      branchName: String(l?.branchName ?? ''),
      translation: l?.translation && typeof l.translation === 'object' ? l.translation : undefined,
    }));
    return {
      list,
      count: Number(res?.data?.count ?? list.length) || 0,
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }

  /** `product/getInventoryLocations/:id` → `{id,name,translation,branchId,products:[{id,name}]}`. */
  async getOne(id: string): Promise<InventoryLocation | null> {
    const res = await this.api.request<any>(this.api.get(`product/getInventoryLocations/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return {
      ...raw,
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      branchId: raw.branchId ?? null,
      translation: raw.translation && typeof raw.translation === 'object' ? { ...raw.translation } : undefined,
      products: Array.isArray(raw.products) ? raw.products.map((p: any) => ({ ...p, id: String(p.id) })) : [],
    };
  }

  /** `product/saveInventoryLocations` — insert when `id` is null/empty, else update. */
  async save(payload: Partial<InventoryLocation>): Promise<{ success: boolean; data?: any }> {
    const res = await this.api.request<any>(this.api.post('product/saveInventoryLocations', payload));
    return { success: !!res?.success, data: res?.data };
  }

  /**
   * `company/validateName` with `tableName: 'inventoryLocations'` — unique per
   * branch. (The legacy app sent `'InventoryLocations'`, which the backend's
   * case-sensitive switch never matched, so its live check did nothing; the
   * save itself still enforces it.) `success: true` means the name is free.
   */
  async isNameFree(name: string, id: string | null, branchId: string | null): Promise<boolean> {
    const res = await this.api.request<any>(this.api.post('company/validateName', {
      tableName: 'inventoryLocations',
      id: id ?? '',
      name,
      branchId: branchId ?? '',
    }));
    return !!res?.success;
  }

  /** `branch/getBranches` — picker source (same call the other forms use). */
  async getBranches(params: { page: number; limit: number; searchTerm: string }):
    Promise<{ list: { id: string; name: string }[]; pageCount: number }> {
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', { ...params, sortBy: {} }));
    const raw: any[] = res?.data?.list ?? [];
    return {
      list: raw.map((b) => ({ id: String(b.id), name: String(b.name ?? '') })),
      pageCount: Number(res?.data?.pageCount ?? 1) || 1,
    };
  }
}
