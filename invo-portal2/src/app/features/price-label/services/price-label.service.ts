import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  PriceLabel,
  PriceLabelListParams,
  PriceLabelListResponse,
  PriceLabelSummary,
} from './price-label.types';

/**
 * Wraps the legacy product/price-label endpoints.
 *
 *   POST product/getPriceLabelList                  → list
 *   GET  product/getPriceLabel/:id                  → single read
 *   POST product/savePriceLabel                     → upsert
 *   GET  product/deletePriceLabel/:id               → delete (legacy
 *                                                     endpoint kept
 *                                                     even when the
 *                                                     server uses a
 *                                                     different verb;
 *                                                     adjust if 404)
 *
 * The wire format is the full `PriceLabel` (scalar fields at the
 * top, `productsPrices[]` and `optionsPrices[]` arrays). Server
 * filters duplicates and trims whitespace; the front-end does no
 * extra normalisation.
 */
@Injectable({ providedIn: 'root' })
export class PriceLabelService {
  private api = inject(ApiService);

  async getList(params: PriceLabelListParams = {}): Promise<PriceLabelListResponse> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy ?? {},
    };
    const res = await this.api.request<any>(
      this.api.post('product/getPriceLabelList', body),
    );
    const data = res?.data ?? {};
    const list: any[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
    const mapped: PriceLabelSummary[] = list.map((p: any) => ({
      id:             String(p?.id ?? ''),
      name:           String(p?.name ?? ''),
      companyId:      p?.companyId ? String(p.companyId) : undefined,
      // Backend ships pre-aggregated counts — read them as-is.
      // Falls back to the inline array length if a future revision
      // ships full arrays instead of just counts.
      productsCount:  p?.productsCount != null
                        ? Number(p.productsCount)
                        : (Array.isArray(p?.productsPrices) ? p.productsPrices.length : undefined),
      optionsCount:   p?.optionsCount != null
                        ? Number(p.optionsCount)
                        : (Array.isArray(p?.optionsPrices) ? p.optionsPrices.length : undefined),
      // Inline arrays — kept under canonical shape when present
      // so the editor can skip `getById` if a future backend
      // revision ships them on the list response.
      productsPrices: Array.isArray(p?.productsPrices) ? this.normalizeProductLines(p.productsPrices) : undefined,
      optionsPrices:  Array.isArray(p?.optionsPrices)  ? this.normalizeOptionLines(p.optionsPrices)   : undefined,
    }));
    return {
      list:      mapped,
      count:     Number(data?.count ?? mapped.length) || 0,
      pageCount: Number(data?.pageCount ?? Math.ceil(((data?.count ?? mapped.length) || 0) / (body.limit || 15))) || 1,
    };
  }

  async getById(id: string): Promise<PriceLabel | null> {
    const res = await this.api.request<any>(
      this.api.get(`product/getPriceLabel/${id}`),
    );
    if (!res?.success) return null;
    const raw = res?.data;
    if (!raw || typeof raw !== 'object') return null;
    return {
      id:             String(raw.id ?? ''),
      name:           String(raw.name ?? ''),
      companyId:      String(raw.companyId ?? ''),
      productsPrices: this.normalizeProductLines(raw.productsPrices),
      optionsPrices:  this.normalizeOptionLines(raw.optionsPrices),
      updatedDate:    raw.updatedDate ? String(raw.updatedDate) : undefined,
    };
  }

  /** Normalise the per-line shape returned by the server into the
   *  front-end's canonical `PriceLabelProductLine`. The server uses
   *  `name` for the product name; the front-end stores it as
   *  `productName` to keep the display field separate from the
   *  label's own `name`. Same for the id (`productId` ↔ catalog id).
   *  Falls back through both shapes so existing rows persisted in
   *  either format round-trip cleanly. */
  private normalizeProductLines(raw: any): any[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((p: any) => ({
      productId:    String(p?.productId ?? p?.id ?? ''),
      productName:  p?.productName ?? p?.name ?? '',
      barcode:      p?.barcode,
      type:         p?.type,
      defaultPrice: p?.defaultPrice != null ? Number(p.defaultPrice) : undefined,
      price:        Number(p?.price ?? 0) || 0,
    }));
  }

  /** Same idea for option lines — server `optionId` + `name`,
   *  front-end keeps `optionId` but mirrors `name` and an optional
   *  `defaultPrice` chip. */
  private normalizeOptionLines(raw: any): any[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((o: any) => ({
      optionId:     String(o?.optionId ?? o?.id ?? ''),
      name:         o?.name ?? o?.displayName ?? '',
      defaultPrice: o?.defaultPrice != null ? Number(o.defaultPrice) : undefined,
      price:        Number(o?.price ?? 0) || 0,
    }));
  }

  async save(p: PriceLabel): Promise<{ id: string } | null> {
    const res = await this.api.request<any>(
      this.api.post('product/savePriceLabel', p),
    );
    if (!res?.success) return null;
    const newId = res?.data?.id ?? p.id;
    return newId ? { id: String(newId) } : null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.get(`product/deletePriceLabel/${id}`),
    );
    return !!res?.success;
  }

  /** Bulk-import per-product overrides for a price label. Mirrors
   *  the legacy `product/importPriceLabel` payload — `{ id, name,
   *  products: [{ barcode, price }, …] }`. Server queues the job
   *  in the background and returns once the queue accepts it.
   *
   *  `mode` is a client-supplied hint (`add_update` | `override` |
   *  `add_only`) — the legacy server merges by barcode regardless
   *  and ignores unknown fields, so the UI stays correct even when
   *  the backend hasn't shipped mode handling yet. The form-side
   *  `add_only` semantics are enforced client-side via a pre-fetch
   *  + barcode filter (see `price-label-import.config.ts`). */
  async importPriceLabel(payload: {
    id: string;
    name: string;
    products: { barcode: string; price: number }[];
    mode?: string;
  }): Promise<{ success: boolean; msg?: string } | null> {
    const res = await this.api.request<any>(
      this.api.post('product/importPriceLabel', payload),
    );
    if (!res) return null;
    return { success: !!res.success, msg: res.msg };
  }

  /** Active import job for a price label, if any. Returned shape
   *  matches the legacy endpoint — `success: true` means *no* job
   *  in flight. The list / form pages use it to gate the Import
   *  modal. */
  async getBulkImportProgress(id: string): Promise<{ success: boolean; msg?: string } | null> {
    const res = await this.api.request<any>(
      this.api.get(`product/getPriceLabelBulkImportProgress/${id}`),
    );
    if (!res) return null;
    return { success: !!res.success, msg: res.msg };
  }

  /** Bulk-import per-option overrides for a price label. Mirrors
   *  the product flow at `importPriceLabel`, but keyed by the
   *  option's display **name** rather than its id (option ids are
   *  opaque to users — the server resolves name → optionId at
   *  submit time). Server stores the merged set on the label's
   *  `optionsPrices` array. `mode` accepts the same three values:
   *  `add_update` | `override` | `add_only`. */
  async importPriceLabelOptions(payload: {
    id: string;
    name: string;
    options: { name: string; price: number }[];
    mode?: string;
  }): Promise<{ success: boolean; msg?: string } | null> {
    const res = await this.api.request<any>(
      this.api.post('product/importPriceLabelOptions', payload),
    );
    if (!res) return null;
    return { success: !!res.success, msg: res.msg };
  }

  /** Same gate as `getBulkImportProgress` but for the options
   *  flow. Server uses a separate Redis key so an in-flight
   *  product import doesn't block an option import (and vice
   *  versa). */
  async getBulkOptionsImportProgress(id: string): Promise<{ success: boolean; msg?: string } | null> {
    const res = await this.api.request<any>(
      this.api.get(`product/getPriceLabelBulkOptionsImportProgress/${id}`),
    );
    if (!res) return null;
    return { success: !!res.success, msg: res.msg };
  }
}
