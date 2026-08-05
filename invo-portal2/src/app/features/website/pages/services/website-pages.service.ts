import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { PageTypeService } from '../../page-types/page-type.service';
import { ListingSource } from '../../page-types/page-type.types';

/** A storefront page as the dashboard edits it. */
export interface WebsitePage {
  id:         string | null;
  name:       string;
  slug:       string;
  /**
   * `template.pageType` — inferred from `templateType` / slug for rows saved
   * before the registry existed, so nothing has to be migrated first.
   *
   * This alone says whether a page is dynamic: `content` has a canvas,
   * everything else is a system page configured through settings. The legacy
   * `isStatic` flag is therefore redundant — it is still WRITTEN on save so the
   * old dashboard and storefront keep reading pages correctly, but nothing here
   * reads it.
   */
  pageType:   string;
  source:     ListingSource | null;
  settings:   Record<string, any>;
  sections:   any[];
  isHomePage: boolean;
  /**
   * published | hidden | redirect.
   *
   * Deliberately a page property rather than a setting: it decides whether the
   * page exists for a visitor, which no per-type option bag should own. It also
   * replaces the old "Redirect menu to shop" toggle — that answered "this
   * merchant is retail" by bouncing people out of a page that stayed in the
   * navigation and in search results.
   */
  status: 'published' | 'hidden' | 'redirect';
  /** Target page slug when `status === 'redirect'`. */
  redirectTo: string;
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
   * Row → typed page.
   *
   * Resolution order for the page KIND, strongest signal first:
   *   1. `template.pageType`     — set by this UI / the backfill
   *   2. `template.templateType` — the OLD dashboard's own field for the kind
   *      (`menu | shop | collection | view-product | appointment |
   *      table-reservation | custom`). More reliable than the slug: a merchant
   *      can rename a URL, but the template type stays.
   *   3. legacy slug map
   *   4. `content`
   *
   * Reading only the slug is what made every existing page show up as a
   * content page — legacy rows carry the kind in `templateType`.
   */
  private fromRow(row: any, rowType: 'Page' | 'StaticPage'): WebsitePage {
    const template = this.parseTemplate(row?.template);

    const slug = String(template['slug'] ?? row?.slug ?? '');
    const templateType = String(template['templateType'] ?? '');

    const pageType =
      String(template['pageType'] ?? '') ||
      this.registry.pageTypeForTemplateType(templateType) ||
      this.registry.pageTypeForSlug(slug);

    const source =
      (template['source']?.kind ? template['source'] : null) ??
      this.registry.sourceForTemplateType(templateType) ??
      this.registry.sourceForSlug(slug);

    return {
      id:         row?.id ?? null,
      name:       String(row?.name ?? template['pageName'] ?? template['name'] ?? ''),
      slug,
      pageType,
      source:     pageType === 'product-list' ? source : null,
      settings:   template['settings'] ?? {},
      sections:   Array.isArray(template['sections']) ? template['sections'] : [],
      isHomePage: !!row?.isHomePage || !!template['isHomePage'],
      // Absent status = published, EXCEPT where a retired option still says
      // otherwise: an un-migrated row with `redirect_to_shop` really does
      // redirect on the live site, so the form must show that rather than
      // claim the page is published.
      status:     (template['status'] as any)
                  ?? (template['settings']?.redirect_to_shop === true ? 'redirect' : 'published'),
      redirectTo: String(template['redirectTo'] ?? (template['settings']?.redirect_to_shop === true ? 'shop' : '')),
      rowType,
    };
  }

  /**
   * `template` comes back as an object from jsonb — but some endpoints hand it
   * over as a JSON string. Reading `.slug` off a string yields undefined, which
   * silently emptied every URL and defaulted every page to `content`.
   */
  private parseTemplate(template: any): Record<string, any> {
    if (!template) return {};
    if (typeof template === 'string') {
      try { return JSON.parse(template) ?? {}; } catch { return {}; }
    }
    return template;
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
        status:     page.status ?? 'published',
        ...(page.status === 'redirect' ? { redirectTo: page.redirectTo } : {}),
        // Legacy compatibility only: derived from the type, never read back.
        // Anything still on the old code path keeps classifying pages right.
        isStatic:   page.pageType !== 'content',
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
      status: 'published',
      redirectTo: '',
      // Row type follows the page type: only a content page is editor-built.
      rowType: pageType === 'content' ? 'Page' : 'StaticPage',
    };
  }
}
