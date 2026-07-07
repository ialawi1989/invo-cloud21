import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';

import {
  Dimension,
  DimensionAttribute,
  DimensionListResponse,
  DimensionListRow,
  MatrixItem,
  MatrixListParams,
  MatrixListResponse,
  MatrixListRow,
  MatrixProduct,
  Translation,
  colorForCode,
  emptyAttribute,
  emptyDimension,
  emptyMatrixItem,
  emptyTranslation,
} from './matrix-item.types';

/**
 * Wraps the legacy matrix + dimension endpoints (shared backend):
 *
 *   POST product/getMatrixList          → paginated matrix list
 *   GET  product/getMatrix/:id          → single matrix (full graph)
 *   POST product/saveMatrix             → upsert matrix
 *   POST product/getDimensionList       → paginated dimension catalog
 *   GET  product/getDimension/:id       → single dimension (with attributes)
 *   POST product/saveDimension          → upsert dimension
 *   POST product/updateMatrixTranslation→ bulk translation update (optional)
 *
 * Wire format matches the legacy models verbatim; we normalise stringly-typed
 * numbers, missing arrays and translation/color shapes here so the rest of the
 * front-end can trust the typed shapes in `matrix-item.types.ts`.
 */
@Injectable({ providedIn: 'root' })
export class MatrixItemService {
  private api = inject(ApiService);

  // ─── Matrix ───────────────────────────────────────────────────────────

  async getMatrixList(params: MatrixListParams = {}): Promise<MatrixListResponse> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getMatrixList', body));
    const data = res?.data ?? {};
    const raw: any[] = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
    return {
      list: raw.map((r) => this.normalizeMatrixRow(r)),
      count: Number(data?.count ?? raw.length) || 0,
      pageCount:
        Number(data?.pageCount ?? Math.ceil((data?.count ?? raw.length) / (body.limit || 15))) || 1,
    };
  }

  async getMatrix(id: string): Promise<MatrixItem | null> {
    const res = await this.api.request<any>(this.api.get(`product/getMatrix/${id}`));
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    return this.normalizeMatrix(raw);
  }

  async saveMatrix(matrix: MatrixItem): Promise<{ success: boolean; id?: string; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('product/saveMatrix', matrix));
    return {
      success: !!res?.success,
      id: res?.data?.id ? String(res.data.id) : matrix.id ?? undefined,
      msg: res?.msg,
    };
  }

  // ─── Dimensions catalog ───────────────────────────────────────────────

  async getDimensionList(params: MatrixListParams = {}): Promise<DimensionListResponse> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      sortBy: params.sortBy ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getDimensionList', body));
    const data = res?.data ?? {};
    const raw: any[] = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
    return {
      list: raw.map((r) => this.normalizeDimensionRow(r)),
      count: Number(data?.count ?? raw.length) || 0,
      pageCount:
        Number(data?.pageCount ?? Math.ceil((data?.count ?? raw.length) / (body.limit || 15))) || 1,
    };
  }

  async getDimension(id: string): Promise<Dimension | null> {
    const res = await this.api.request<any>(this.api.get(`product/getDimension/${id}`));
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    return this.normalizeDimension(raw);
  }

  async saveDimension(dim: Dimension): Promise<{ success: boolean; id?: string; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('product/saveDimension', dim));
    return {
      success: !!res?.success,
      id: res?.data?.id ? String(res.data.id) : dim.id ?? undefined,
      msg: res?.msg,
    };
  }

  /** Optional bulk translation update — not needed by the per-field/bulk
   *  modals (they write into the saved payload) but kept for parity. */
  async updateMatrixTranslation(list: any[]): Promise<{ success: boolean }> {
    const res = await this.api.request<any>(
      this.api.post('product/updateMatrixTranslation', { list }),
    );
    return { success: !!res?.success };
  }

  // ─── Normalizers ──────────────────────────────────────────────────────

  private normalizeMatrixRow = (raw: any): MatrixListRow => ({
    id: String(raw?.id ?? raw?._id ?? ''),
    name: this.flattenName(raw) || String(raw?.name ?? ''),
    barcode: String(raw?.barcode ?? ''),
    defaultPrice: Number(raw?.defaultPrice ?? 0) || 0,
  });

  private normalizeDimensionRow = (raw: any): DimensionListRow => ({
    id: String(raw?.id ?? raw?._id ?? ''),
    name: this.flattenName(raw) || String(raw?.name ?? ''),
    displayType: this.coerceDisplayType(raw?.displayType),
    attributesCount: Array.isArray(raw?.attributes) ? raw.attributes.length : 0,
  });

  private normalizeMatrix(raw: any): MatrixItem {
    const base = emptyMatrixItem();
    return {
      ...base,
      id: raw?.id != null ? String(raw.id) : null,
      name: String(raw?.name ?? ''),
      translation: this.normalizeTranslation(raw?.translation, String(raw?.name ?? '')),
      barcode: String(raw?.barcode ?? ''),
      defaultPrice: Number(raw?.defaultPrice ?? 0) || 0,
      unitCost: Number(raw?.unitCost ?? 0) || 0,
      companyId: String(raw?.companyId ?? ''),
      mediaId: raw?.mediaId != null ? String(raw.mediaId) : null,
      mediaUrl: {
        defaultUrl: raw?.mediaUrl?.defaultUrl ?? '',
        thumbnailUrl: raw?.mediaUrl?.thumbnailUrl ?? '',
      },
      dimensions: Array.isArray(raw?.dimensions)
        ? raw.dimensions.map((d: any) => ({ ...this.normalizeDimension(d), isNew: false }))
        : [],
      products: Array.isArray(raw?.products)
        ? raw.products.map((p: any) => this.normalizeProduct(p))
        : [],
    };
  }

  private normalizeProduct(raw: any): MatrixProduct {
    const bp = Array.isArray(raw?.branchProduct) ? raw.branchProduct : [];
    return {
      id: raw?.id != null ? String(raw.id) : null,
      productId: raw?.productId != null ? String(raw.productId) : undefined,
      name: String(raw?.name ?? ''),
      barcode: String(raw?.barcode ?? ''),
      sku: String(raw?.sku ?? ''),
      attribute1: String(raw?.attribute1 ?? ''),
      attribute2: String(raw?.attribute2 ?? ''),
      attribute3: String(raw?.attribute3 ?? ''),
      openingBalanceCost: Number(raw?.openingBalanceCost ?? 0) || 0,
      branchProduct: bp.map((b: any) => ({
        branchId: String(b?.branchId ?? ''),
        onHand: Number(b?.onHand ?? 0) || 0,
        price: Number(b?.price ?? 0) || 0,
        // Clamp negative opening balances to 0 (legacy did this on load).
        openingBalance: Math.max(0, Number(b?.openingBalance ?? 0) || 0),
        openingBalanceCost: Number(b?.openingBalanceCost ?? 0) || 0,
      })),
    };
  }

  private normalizeDimension(raw: any): Dimension {
    const base = emptyDimension();
    const name = String(raw?.name ?? '');
    const type = String(raw?.type ?? '') || name.toLowerCase();
    return {
      ...base,
      id: raw?.id != null && raw.id !== '' ? String(raw.id) : base.id,
      type,
      name,
      displayType: this.coerceDisplayType(raw?.displayType),
      isRequired: raw?.isRequired !== false,
      isNew: false,
      translation: this.normalizeTranslation(raw?.translation, name),
      attributes: Array.isArray(raw?.attributes)
        ? raw.attributes.map((a: any) => this.normalizeAttribute(a))
        : [],
      presetAttributes: Array.isArray(raw?.presetAttributes)
        ? raw.presetAttributes.map((a: any) => this.normalizeAttribute(a))
        : [],
    };
  }

  private normalizeAttribute(raw: any): DimensionAttribute {
    const base = emptyAttribute();
    const code = String(raw?.code ?? '');
    const name = String(raw?.name ?? '');
    // Colour attributes derive their swatch from the preset table when the
    // stored value is missing/default.
    const value =
      raw?.value && raw.value !== '#000000' ? String(raw.value) : colorForCode(code) || base.value;
    return {
      ...base,
      id: String(raw?.id ?? ''),
      name,
      code,
      value,
      isActive: raw?.isActive !== false,
      isNew: false,
      onHand: Number(raw?.onHand ?? 0) || 0,
      translation: this.normalizeTranslation(raw?.translation, name),
    };
  }

  private normalizeTranslation(raw: any, fallbackEn = ''): Translation {
    const t = emptyTranslation();
    if (raw && typeof raw === 'object') {
      for (const key of Object.keys(raw)) {
        const v = raw[key];
        if (v && typeof v === 'object') {
          t[key] = { en: String(v.en ?? ''), ar: String(v.ar ?? '') };
        }
      }
    }
    if (!t.name) t.name = { en: '', ar: '' };
    if (!t.name.en && fallbackEn) t.name.en = fallbackEn;
    return t;
  }

  private coerceDisplayType(v: any): Dimension['displayType'] {
    return v === 'radio' || v === 'dropdown' ? v : 'buttons';
  }

  /** Pick a plain string out of a `name`/`displayName` field that may be a
   *  string or a `{en, ar, …}` translation map. */
  private flattenName(raw: any): string {
    const dn = raw?.displayName;
    if (typeof dn === 'string' && dn.trim()) return dn;
    const n = raw?.name;
    if (typeof n === 'string') return n;
    if (n && typeof n === 'object') {
      for (const v of Object.values(n)) {
        if (typeof v === 'string' && (v as string).trim()) return v as string;
      }
    }
    return '';
  }
}
