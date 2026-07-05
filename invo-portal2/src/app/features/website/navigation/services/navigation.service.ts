import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { ProductCollectionService } from '@features/products/services/product-collection.service';
import { Website } from '../../models/website.model';

/**
 * Navigation persistence — menus + mobile icon bar.
 *
 * Both entities are stored in the generic polymorphic "website theme"
 * table, discriminated by `type`:
 *   • `Menus`         → a header / footer navigation (`NavigationList`)
 *   • `MobileIconBar` → the storefront bottom bar (`MobileIconBarList`)
 *
 * All traffic goes through the shared {@link ApiService} (base URL,
 * auth interceptor, and the `{ success, msg, data }` envelope live
 * there — never a bespoke HttpClient here). Mirrors the SEO / content
 * library services: round-trip the row `id` on save so the backend
 * UPDATEs the existing row instead of inserting a duplicate.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private api        = inject(ApiService);
  private collections = inject(ProductCollectionService);

  // ─── Menus ────────────────────────────────────────────────────────────

  /** All saved navigation menus (primary + footer). */
  async listMenus(): Promise<Website[]> {
    const res = await this.api.request(
      this.api.post('company/getThemeByType', { type: 'Menus' }),
    );
    return (res?.data?.list ?? []).map((row: any) => {
      if (!row.type) row.type = 'Menus';
      const w = new Website();
      w.ParseJson(row);
      return w;
    });
  }

  /** A single menu by backend id, parsed into a `Website` (template = `NavigationList`). */
  async getMenu(id: string): Promise<Website> {
    const res = await this.api.request(this.api.get(`company/getThemeById/${id}`));
    const row = res?.data ?? {};
    if (!row.type) row.type = 'Menus';
    const w = new Website();
    w.ParseJson(row);
    return w;
  }

  /** Persist a menu. Returns the row id so the caller keeps it for the next save. */
  async saveMenu(menu: Website): Promise<{ id: string | null }> {
    const res = await this.api.request(
      this.api.post('company/saveWebsiteTheme', menu.toCleanJson()),
    );
    if (res.success === false) {
      throw new Error(res.msg || res.message || 'Failed to save menu');
    }
    const id = res?.data?.id ?? res?.data?.list?.[0]?.id ?? menu.id ?? null;
    return { id: id != null ? String(id) : null };
  }

  async deleteMenu(id: string): Promise<void> {
    await this.api.call(this.api.delete(`company/deletTheme/${id}`));
  }

  // ─── Mobile icon bar ────────────────────────────────────────────────────

  /** The (singleton) mobile icon bar row, or `null` if none saved yet. */
  async getMobileIconBar(): Promise<Website | null> {
    const res = await this.api.request(
      this.api.post('company/getThemeByType', { type: 'MobileIconBar' }),
    );
    const row = res?.data?.list?.[0] ?? null;
    if (!row) return null;
    if (!row.type) row.type = 'MobileIconBar';
    const w = new Website();
    w.ParseJson(row);
    return w;
  }

  async saveMobileIconBar(bar: Website): Promise<{ id: string | null }> {
    const res = await this.api.request(
      this.api.post('company/saveWebsiteTheme', bar.toCleanJson()),
    );
    if (res.success === false) {
      throw new Error(res.msg || res.message || 'Failed to save mobile icon bar');
    }
    const id = res?.data?.id ?? bar.id ?? null;
    return { id: id != null ? String(id) : null };
  }

  // ─── Link-picker sources ────────────────────────────────────────────────

  /** Collections available to add as menu links. */
  async getCollections(): Promise<Array<{ title: string; id: string }>> {
    const data = await this.collections.getCollectionList({ page: 1, limit: 999 });
    const list = data?.list ?? data ?? [];
    return list.map((c: any) => ({ title: c.title ?? c.name ?? '', id: c.id ?? c._id ?? '' }));
  }

  /** CMS pages available to add as menu links. */
  async getPages(): Promise<Array<{ name: string; id: string }>> {
    const res = await this.api.request(
      this.api.post('company/getThemeByType', { type: 'Page' }),
    );
    return (res?.data?.list ?? []).map((p: any) => ({
      name: p.name ?? '',
      id: p.id ?? p._id ?? '',
    }));
  }
}
