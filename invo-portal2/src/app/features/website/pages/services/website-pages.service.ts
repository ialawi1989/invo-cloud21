import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { PageTypeService } from '../../page-types/page-type.service';
import { ListingSource } from '../../page-types/page-type.types';

/** A storefront page as the dashboard edits it. */
export interface WebsitePage {
  id:         string | null;
  name:       string;
  slug:       string;
  /** `template.pageType` — inferred from the slug for rows saved before the
   *  registry existed, so nothing has to be migrated first. */
  pageType:   string;
  source:     ListingSource | null;
  settings:   Record<string, any>;
  sections:   any[];
  isHomePage: boolean;
  /** Row type in `WebSiteBuilder` — preserved on save so an existing
   *  `StaticPage` row doesn't silently become a `Page`. */
  rowType:    'Page' | 'StaticPage';
}

/**
 * CRUD for storefront pages.
 *
 * Pages live in `WebSiteBuilder` as `Page` / `StaticPage` rows whose `template`
 * carries the slug, the settings blob and (new) the page type + listing source.
 * This service is where a row becomes a typed {@link WebsitePage} and back.
 *
 * Uses the existing endpoints — `company/getThemeByType`, `getThemeById`,
 * `saveWebsiteTheme`, `deletTheme`, `setHomePage` — so no backend change is
 * needed to manage pages.
 */
@Injectable({ providedIn: 'root' })
export class WebsitePagesService {
  private api      = inject(ApiService);
  private registry = inject(PageTypeService);

  /** Every page row, both types, newest last. */
  async list(): Promise<WebsitePage[]> {
    await this.registry.load();

    const [pages, statics] = await Promise.all([
      this.byType('Page'),
      this.byType('StaticPage'),
    ]);
    return [...pages, ...statics];
  }

  private async byType(rowType: 'Page' | 'StaticPage'): Promise<WebsitePage[]> {
    try {
      const res = await this.api.request<any>(
        this.api.post('company/getThemeByType', { type: rowType }),
      );
      return (res?.data?.list ?? []).map((row: any) => this.fromRow(row, rowType));
    } catch {
      return [];
    }
  }

  async getOne(id: string): Promise<WebsitePage | null> {
    await this.registry.load();
    const res = await this.api.request<any>(this.api.get(`company/getThemeById/${id}`));
    const row = res?.data ?? null;
    if (!row) return null;
    return this.fromRow(row, (row.type === 'StaticPage' ? 'StaticPage' : 'Page'));
  }

  async save(page: WebsitePage): Promise<{ success: boolean; msg?: string; id?: string }> {
    const res = await this.api.request<any>(
      this.api.post('company/saveWebsiteTheme', this.toRow(page)),
    );
    return {
      success: res?.success !== false,
      msg:     res?.msg,
      id:      res?.data?.id ?? page.id ?? undefined,
    };
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.api.call(this.api.delete(`company/deletTheme/${id}`));
      return true;
    } catch {
      return false;
    }
  }

  async setHome(id: string): Promise<boolean> {
    try {
      await this.api.call(this.api.put(`company/setHomePage/${id}`, {}));
      return true;
    } catch {
      return false;
    }
  }

  // ── Mapping ────────────────────────────────────────────────────────────
  /**
   * Row → typed page. `pageType` and `source` fall back to the registry's
   * legacy slug maps, which is what lets an untouched database work with the
   * new UI on day one.
   */
  private fromRow(row: any, rowType: 'Page' | 'StaticPage'): WebsitePage {
    const template = row?.template ?? {};
    const slug     = String(template.slug ?? '');
    const pageType = String(template.pageType ?? '') || this.registry.pageTypeForSlug(slug);
    const source   = (template.source?.kind ? template.source : this.registry.sourceForSlug(slug)) ?? null;

    return {
      id:         row?.id ?? null,
      name:       String(row?.name ?? template.pageName ?? ''),
      slug,
      pageType,
      source:     pageType === 'product-list' ? source : null,
      settings:   template.settings ?? {},
      sections:   Array.isArray(template.sections) ? template.sections : [],
      isHomePage: !!row?.isHomePage || !!template.isHomePage,
      rowType,
    };
  }

  /**
   * Typed page → save payload.
   *
   * `settings` keys are written exactly as the manifest names them — the same
   * keys the legacy catalog used — so a page edited here stays readable by
   * anything still on the old code path.
   */
  private toRow(page: WebsitePage): Record<string, any> {
    return {
      ...(page.id ? { id: page.id } : {}),
      type:       page.rowType,
      name:       page.name,
      isHomePage: page.isHomePage,
      template: {
        slug:       page.slug,
        pageName:   page.name,
        pageType:   page.pageType,
        ...(page.source ? { source: page.source } : {}),
        settings:   page.settings ?? {},
        sections:   page.sections ?? [],
        isHomePage: page.isHomePage,
      },
    };
  }

  /** A blank page of the given type, with the manifest's defaults applied. */
  blank(pageType: string): WebsitePage {
    return {
      id: null,
      name: '',
      slug: '',
      pageType,
      source: pageType === 'product-list' ? { kind: 'catalog' } : null,
      settings: this.registry.withDefaults(pageType, {}),
      sections: [],
      isHomePage: false,
      rowType: 'Page',
    };
  }
}
