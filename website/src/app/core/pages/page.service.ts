import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../../features/blog/services/tenant.service';
import { PageTypeService } from '../page-types/page-type.service';
import { SiteConfigService } from '../site-config/site-config.service';
import { ResolvedPage } from '../page-types/page-type.types';

interface Envelope<T> { success: boolean; msg: string; data: T; }

/**
 * Fetches a page row by slug and hands back a {@link ResolvedPage}.
 *
 * The backend read is `GET /v1/ecommerce/<slug>/theme/getPage/:pageSlug`, which
 * returns `{ name, template }`. Everything after that — which page type this
 * is, which settings apply, where a listing gets its products — is decided by
 * the registry, not by the slug being hardcoded somewhere.
 *
 * NOTE for the backend: that query filters only on `template->>'slug'` with no
 * `type` filter, so a `StaticPage` row can shadow a `Page` row with the same
 * slug (last created wins). Tracked in the backend module's README.
 */
@Injectable({ providedIn: 'root' })
export class PageService {
  private http     = inject(HttpClient);
  private tenant   = inject(TenantService);
  private registry = inject(PageTypeService);
  private siteConfig = inject(SiteConfigService);

  private cache = new Map<string, ResolvedPage>();

  async getPage(slug: string): Promise<ResolvedPage> {
    const key = slug || 'home';
    const cached = this.cache.get(key);
    if (cached) return cached;

    // The registry must be loaded before resolving, or a legacy row would fall
    // back to `content` and a listing page would render as an empty canvas.
    // Site config supplies defaults for settings that moved up from pages, so
    // it has to be in hand before a page is resolved.
    await Promise.all([this.registry.load(), this.siteConfig.load()]);

    let row: any = null;
    try {
      const company = encodeURIComponent(this.tenant.slug());
      const env = await firstValueFrom(
        this.http.get<Envelope<any>>(
          `${environment.apiBase}/v1/ecommerce/${company}/theme/getPage/${encodeURIComponent(key)}`,
          { headers: new HttpHeaders({ 'X-Sub-Domain': this.tenant.slug() }) },
        ),
      );
      row = env?.success ? env.data : null;
    } catch {
      row = null;
    }

    const resolved = this.registry.resolve(key, row, this.siteConfig.commerce());
    this.cache.set(key, resolved);
    return resolved;
  }

  /** Drop a cached page (editor preview saves, language switch). */
  invalidate(slug?: string): void {
    if (slug) this.cache.delete(slug);
    else this.cache.clear();
  }
}
