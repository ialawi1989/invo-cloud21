import { inject, Injectable } from '@angular/core';
import { ApiService } from '@core/http';
import {
  COLOR_SCHEMES,
  DEFAULT_COLOR_SCHEME,
  GRID_COLS,
  Menu,
  MenuListItem,
  MenuListPage,
  MenuSection,
  MenuSectionColor,
  MenuSectionProduct,
  MenuTranslation,
} from './menu-builder.types';

/**
 * Wraps the legacy `product/*Menu*` endpoints. Same wire shape as the
 * old builder so existing menus open here without migration:
 *
 *   POST   product/getMenuList
 *   GET    product/getMenu/:id
 *   POST   product/saveMenu
 *   GET    product/getBranchProducts/:branchId
 *   POST   product/setProductColor
 *   POST   product/setProductMedia
 *   POST   product/rearrangeMenu       (reorders menus within a branch)
 *   POST   product/deleteMenu          (soft delete, when present)
 *
 * Wire <-> model mapping notes:
 *   - The wire still sends per-product `index`, `doubleWidth`,
 *     `doubleHeight`. We project those on serialise / derive `x/y/cols/
 *     rows` on parse so the in-memory model only ever uses the grid
 *     coordinates (single source of truth, see `menu-builder.types.ts`).
 *   - Legacy `colorName` of `'Default'` is normalised to `'Razzmatazz'`
 *     to match the legacy parser's behaviour.
 */
@Injectable({ providedIn: 'root' })
export class MenuBuilderService {
  private api = inject(ApiService);

  // ─── List ────────────────────────────────────────────────────────────
  async getList(params: { page?: number; limit?: number; search?: string } = {}): Promise<MenuListPage> {
    const body = { page: params.page ?? 1, limit: params.limit ?? 50, ...(params.search ? { search: params.search } : {}) };
    const res = await this.api.request<any>(this.api.post('product/getMenuList', body));
    const raw = res?.data ?? res;
    const list: any[] = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : [];
    return {
      list: list.map((m): MenuListItem => ({
        id:              String(m?.id ?? ''),
        name:            String(m?.name ?? ''),
        branchIds:       Array.isArray(m?.branchIds) ? m.branchIds.map(String) : [],
        startAt:         String(m?.startAt ?? '00:00:00'),
        endAt:           String(m?.endAt   ?? '23:59:00'),
        availableOnline: m?.availableOnline !== false,
        index:           int(m?.index, 0),
        sectionsCount:   Array.isArray(m?.sections) ? m.sections.length : (m?.sectionsCount ?? undefined),
      })),
      total: int(raw?.total ?? raw?.count ?? list.length, list.length),
    };
  }

  // ─── Single read ─────────────────────────────────────────────────────
  async getMenu(id: string): Promise<Menu | null> {
    const res = await this.api.request<any>(this.api.get(`product/getMenu/${id}`));
    const raw = res?.data ?? res;
    if (!raw) return null;
    return this.parseMenu(raw);
  }

  // ─── Save (create or update) ─────────────────────────────────────────
  async save(menu: Menu): Promise<{ success: boolean; data?: Menu | null }> {
    const payload = this.serialiseMenu(menu);
    const res = await this.api.request<any>(this.api.post('product/saveMenu', payload));
    const ok = res?.success !== false;
    const data = res?.data ? this.parseMenu(res.data) : null;
    return { success: ok, data };
  }

  // NOTE: the backend has no `deleteMenu` endpoint at the moment
  // (`backend/src/routes/v1/app/product.ts` only exposes saveMenu /
  // getMenu / getMenuList / rearrangeMenu). The list page therefore
  // does NOT surface a delete action — when the route ships, add it
  // here as `deleteMenu(id)` and re-enable the row icon.

  /** Persist a new ordering of menus within a branch. */
  async rearrange(payload: Array<{ id: string; index: number }>): Promise<boolean> {
    const res = await this.api.request<any>(this.api.post('product/rearrangeMenu', payload));
    return res?.success !== false;
  }

  // ─── Price labels (used by the form's price-tier dropdown) ──────────
  async getPriceLabels(): Promise<Array<{ id: string; name: string }>> {
    const res = await this.api.request<any>(this.api.post('product/getPriceLabelList', { page: 1, limit: 200 }));
    const raw = res?.data ?? res;
    const list: any[] = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : [];
    return list.map((p) => ({ id: String(p?.id ?? ''), name: String(p?.name ?? '') }));
  }

  // ─── Products picker (paginated, company-wide) ──────────────────────
  // Legacy `pick-product-modal` calls `productService.menuProductList`
  // which is the `product/menuProductList` POST endpoint — paginated,
  // searchable, company-scoped (NOT branch-scoped, despite my earlier
  // `getBranchProducts` stub). Mirroring that here so the picker shows
  // every menu-eligible product regardless of which branch the menu
  // is linked to.
  async listMenuProducts(params: { page?: number; limit?: number; searchTerm?: string } = {}): Promise<{
    list: Array<{ id: string; name: string; defaultImage: string; color: string; categoryId: string; categoryName: string }>;
    count: number;
  }> {
    const body = {
      page:       params.page  ?? 1,
      limit:      params.limit ?? 50,
      searchTerm: params.searchTerm ?? '',
    };
    const res = await this.api.request<any>(this.api.post('product/menuProductList', body));
    const raw = res?.data ?? res;
    const list: any[] = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : [];
    // Backend joins `Categories` and emits `categoryId` + `categoryName`
    // (with `'Uncategorized'` fallback already applied via SQL COALESCE).
    return {
      list: list.map((p) => ({
        id:           String(p?.id ?? ''),
        name:         String(p?.name ?? ''),
        defaultImage: String(p?.defaultImage ?? p?.image ?? ''),
        color:        String(p?.color ?? ''),
        categoryId:   String(p?.categoryId   ?? ''),
        categoryName: String(p?.categoryName ?? ''),
      })),
      count: typeof raw?.count === 'number' ? raw.count : list.length,
    };
  }

  // ─── Inline persistence helpers (called from the form on edit) ──────
  async setProductColor(p: { id: string | null; productId: string; color: string }): Promise<boolean> {
    if (!p.id) return true; // Unsaved item — nothing to push yet, save() will carry it.
    const res = await this.api.request<any>(this.api.post('product/setProductColor', p));
    return res?.success !== false;
  }

  async setProductMedia(p: { id: string | null; mediaId: string | null; defaultImage: string }): Promise<boolean> {
    if (!p.id) return true;
    const res = await this.api.request<any>(this.api.post('product/setProductMedia', p));
    return res?.success !== false;
  }

  // ─── Wire ↔ model mappers ────────────────────────────────────────────
  private parseMenu(raw: any): Menu {
    return {
      id:              raw?.id ? String(raw.id) : null,
      name:            String(raw?.name ?? ''),
      branchIds:       parseBranchIds(raw?.branchIds),
      priceLabelId:    String(raw?.priceLabelId ?? ''),
      startAt:         String(raw?.startAt ?? '00:00:00'),
      endAt:           String(raw?.endAt   ?? '23:59:00'),
      availableOnline: raw?.availableOnline !== false,
      index:           int(raw?.index, 0),
      sections:        Array.isArray(raw?.sections)
        ? raw.sections.map((s: any) => this.parseSection(s))
        : [],
    };
  }

  private parseSection(raw: any): MenuSection {
    const properties = raw?.properties ?? {};
    return {
      id:          raw?.id ? String(raw.id) : null,
      name:        String(raw?.name ?? ''),
      translation: parseTranslation(raw?.translation),
      image:       String(raw?.image ?? ''),
      pages:       clamp(int(raw?.pages, 1), 1, 3),
      color:       parseColor(properties?.color ?? raw?.color),
      products:    Array.isArray(raw?.products)
        ? raw.products.map((p: any) => this.parseProduct(p))
        : [],
    };
  }

  /** Wire (`index`, `doubleWidth`, `doubleHeight`) → grid coords. */
  private parseProduct(raw: any): MenuSectionProduct {
    const cols = raw?.doubleWidth  ? 2 : int(raw?.cols, 1);
    const rows = raw?.doubleHeight ? 2 : int(raw?.rows, 1);
    // Prefer explicit x/y when the wire carries them; otherwise derive
    // from the legacy linear `index` (`x = index % 6`, `y = floor / 6`).
    const idx = int(raw?.index, 0);
    const x = raw?.x != null ? int(raw.x, 0) : (idx % GRID_COLS);
    const y = raw?.y != null ? int(raw.y, 0) : Math.floor(idx / GRID_COLS);
    return {
      id:           raw?.id ? String(raw.id) : null,
      productId:    String(raw?.productId ?? ''),
      productName:  String(raw?.productName ?? ''),
      page:         clamp(int(raw?.page, 1), 1, 3),
      x:            clamp(x, 0, GRID_COLS - 1),
      y:            clamp(y, 0, 100),
      cols:         cols === 2 ? 2 : 1,
      rows:         rows === 2 ? 2 : 1,
      color:        String(raw?.color ?? ''),
      defaultImage: String(raw?.defaultImage ?? ''),
      mediaId:      raw?.mediaId ? String(raw.mediaId) : null,
    };
  }

  /**
   * Inverse of `parseProduct`.
   *
   * The in-memory model uses `{ x, y, cols, rows }` as the single source
   * of truth; the **backend wants only `index` + `doubleWidth` +
   * `doubleHeight`** (legacy shape) and rejects anything else. So this
   * projection drops the grid coords and emits the linear `index`
   * (`y * GRID_COLS + x`) plus the two boolean span flags. If you ever
   * need to extend the wire shape, do it here — components downstream
   * keep working with `x/y/cols/rows`.
   */
  private serialiseProduct(p: MenuSectionProduct): Record<string, unknown> {
    return {
      id:           p.id,
      productId:    p.productId,
      productName:  p.productName,
      page:         p.page,
      index:        p.y * GRID_COLS + p.x,
      doubleWidth:  p.cols === 2,
      doubleHeight: p.rows === 2,
      color:        p.color,
      defaultImage: p.defaultImage,
      mediaId:      p.mediaId,
    };
  }

  private serialiseSection(s: MenuSection, index: number): Record<string, unknown> {
    return {
      id:          s.id,
      name:        s.name,
      translation: s.translation,
      image:       s.image,
      pages:       s.pages,
      index,
      properties:  { color: s.color },
      products:    s.products.map((p) => this.serialiseProduct(p)),
    };
  }

  private serialiseMenu(m: Menu): Record<string, unknown> {
    return {
      id:              m.id,
      name:            m.name,
      branchIds:       m.branchIds,
      priceLabelId:    m.priceLabelId,
      startAt:         m.startAt,
      endAt:           m.endAt,
      availableOnline: m.availableOnline,
      index:           m.index,
      sections:        m.sections.map((s, i) => this.serialiseSection(s, i)),
    };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────
/**
 * Wire `branchIds` is one of two shapes depending on the endpoint:
 *   - List endpoint:  `["id1", "id2"]`           — array of string ids
 *   - Single get:     `[{ branchId: "id1" }, …]` — array of objects
 * Always normalise to `string[]` so the form's `branchIds` is a flat
 * id list (what the multi-select dropdown round-trips on).
 */
function parseBranchIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      if (typeof b === 'string')                       return b;
      if (b && typeof b === 'object' && 'branchId' in b) return String((b as any).branchId ?? '');
      if (b && typeof b === 'object' && 'id'       in b) return String((b as any).id       ?? '');
      return '';
    })
    .filter((s) => !!s);
}

function int(v: unknown, fb: number): number {
  if (v == null || v === '') return fb;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fb;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function parseTranslation(raw: any): MenuTranslation {
  if (!raw || typeof raw !== 'object') return {};
  const out: MenuTranslation = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function parseColor(raw: any): MenuSectionColor {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COLOR_SCHEME };
  const colorName = raw.colorName === 'Default' ? 'Razzmatazz' : String(raw.colorName ?? DEFAULT_COLOR_SCHEME.colorName);
  return {
    colorName,
    borderColor: String(raw.borderColor ?? DEFAULT_COLOR_SCHEME.borderColor),
    colorStart:  String(raw.colorStart  ?? DEFAULT_COLOR_SCHEME.colorStart),
    colorEnd:    String(raw.colorEnd    ?? DEFAULT_COLOR_SCHEME.colorEnd),
  };
}

export { COLOR_SCHEMES };
