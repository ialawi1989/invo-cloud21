import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** One product entry as the kitchen-section endpoint returns it. */
export interface KitchenProduct {
  id:           string;
  name:         string;
  /** Optional fields that round-trip through to keep the record intact. */
  type?:        string;
  barcode?:     string;
  sku?:         string;
  UOM?:         string;
  unitCost?:    number;
  defaultPrice?: number;
  price?:       number;
  categoryName?: string;
  thumbnailUrl?: string;
  /** Catch-all for fields the legacy backend stores on each product entry. */
  [key: string]: unknown;
}

/** Summary row in the list table. */
export interface KitchenSectionSummary {
  id:    string;
  name:  string;
  /** Aggregate product count — surfaced as a chip on the list row. */
  productCount: number;
  updatedDate?: string;
}

/** Full record returned by the get-one endpoint. */
export interface KitchenSectionDetails {
  /** `null` on create — backend assigns a real id on save. */
  id:        string | null;
  name:      string;
  products:  KitchenProduct[];
  companyId?:   string;
  updatedDate?: string;
  /** Per-language overrides — `{ name: { en, ar } }`. Same shape as branch.translation. */
  translation?: {
    name?: { en: string; ar: string };
    [key: string]: unknown;
  };
}

export interface KitchenSectionListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface KitchenSectionListResult {
  list:       KitchenSectionSummary[];
  count:      number;
  pageCount:  number;
  startIndex: number;
  lastIndex:  number;
}

/**
 * KitchenSectionService
 * ─────────────────────
 * Wraps the legacy `product/getKitchenSectionList`,
 * `product/getKitchenSection/:id`, and `product/saveKitchenSection`
 * endpoints. Mirrors the lazy/normalising pattern of the other
 * settings services so the pages don't have to know the wire shape.
 */
@Injectable({ providedIn: 'root' })
export class KitchenSectionService {
  private api = inject(ApiService);

  async getList(params: KitchenSectionListParams = {}): Promise<KitchenSectionListResult> {
    const body = {
      page:       params.page       ?? 1,
      limit:      params.limit      ?? 20,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy     ?? {},
    };
    const res = await this.api.request<any>(
      this.api.post('product/getKitchenSectionList', body),
    );
    const raw: any[] = res?.data?.list ?? [];
    const list: KitchenSectionSummary[] = raw.map((s) => ({
      id:           String(s?.id ?? ''),
      name:         String(s?.name ?? ''),
      productCount: Array.isArray(s?.products) ? s.products.length : (s?.productCount ?? 0),
      updatedDate:  s?.updatedDate,
    }));
    return {
      list,
      count:      res?.data?.count      ?? list.length,
      pageCount:  res?.data?.pageCount  ?? 1,
      startIndex: res?.data?.startIndex ?? 0,
      lastIndex:  res?.data?.lastIndex  ?? list.length,
    };
  }

  async getOne(id: string): Promise<KitchenSectionDetails | null> {
    const res = await this.api.request<any>(this.api.get(`product/getKitchenSection/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return this.mapDetails(raw);
  }

  /**
   * Save (create-or-update). Backend accepts the merged record; we
   * round-trip the original payload + edits so unrelated fields the
   * backend stored don't get dropped.
   */
  async save(payload: Partial<KitchenSectionDetails>): Promise<{ success: boolean; data?: any }> {
    const res = await this.api.request<any>(
      this.api.post('product/saveKitchenSection', payload),
    );
    return { success: !!res?.success, data: res?.data };
  }

  // ─── Internal ──────────────────────────────────────────────────────────
  private mapDetails(raw: any): KitchenSectionDetails {
    return {
      id:           String(raw?.id ?? ''),
      name:         String(raw?.name ?? ''),
      products:     Array.isArray(raw?.products) ? raw.products.map((p: any) => ({ ...p })) : [],
      companyId:    raw?.companyId,
      updatedDate:  raw?.updatedDate,
      translation:  (raw?.translation && typeof raw.translation === 'object')
        ? { ...raw.translation }
        : undefined,
    };
  }
}
