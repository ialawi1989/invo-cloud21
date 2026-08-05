import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantService } from '../../features/blog/services/tenant.service';

interface Envelope<T> { success: boolean; msg: string; data: T; }

export interface SiteConfigDocument {
  version: string;
  /** True when the company has no theme row yet — you're looking at defaults. */
  seeded:  boolean;
  branding: Record<string, any>;
  layout:   Record<string, any>;
  contact:  Record<string, any>;
  commerce: Record<string, any>;
  seo:      Record<string, any>;
  blog:     Record<string, any>;
  navigation: { primaryMenuId: string | null; footerMenuId: string | null; hasMobileIconBar: boolean };
  extra:    Record<string, any>;
}

const EMPTY: SiteConfigDocument = {
  version: '0', seeded: true,
  branding: {}, layout: {}, contact: {}, commerce: {}, seo: {}, blog: {},
  navigation: { primaryMenuId: null, footerMenuId: null, hasMobileIconBar: false },
  extra: {},
};

/**
 * Site configuration for the storefront — one fetch for branding, layout,
 * contact details, commerce rules, SEO and blog settings.
 *
 * Replaces "call getThemeByType for the theme, then again for SEO, then the
 * blog settings service, and know each blob's shape". The document is assembled
 * server-side from the same rows those calls read, so nothing here is a second
 * copy of anything.
 *
 * Never throws: if the endpoint isn't mounted yet, sections read as empty and
 * callers fall back to their own defaults, exactly as they do today.
 */
@Injectable({ providedIn: 'root' })
export class SiteConfigService {
  private http   = inject(HttpClient);
  private tenant = inject(TenantService);

  private doc = signal<SiteConfigDocument>(EMPTY);
  private loaded = false;
  private inFlight: Promise<void> | null = null;

  config = this.doc.asReadonly();

  branding = computed(() => this.doc().branding);
  layout   = computed(() => this.doc().layout);
  contact  = computed(() => this.doc().contact);
  commerce = computed(() => this.doc().commerce);
  seo      = computed(() => this.doc().seo);
  blog     = computed(() => this.doc().blog);

  load(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    return (this.inFlight ??= this.doLoad());
  }

  private async doLoad(): Promise<void> {
    try {
      const company = encodeURIComponent(this.tenant.slug());
      const env = await firstValueFrom(
        this.http.get<Envelope<SiteConfigDocument>>(
          `${environment.apiBase}/v1/ecommerce/${company}/website/siteConfig`,
          { headers: new HttpHeaders({ 'X-Sub-Domain': this.tenant.slug() }) },
        ),
      );
      if (env?.success && env.data) this.doc.set({ ...EMPTY, ...env.data });
    } catch {
      // Endpoint not mounted / offline — defaults stand.
    } finally {
      this.loaded = true;
      this.inFlight = null;
    }
  }

  /** Read one value with a fallback, e.g. `value('branding', 'websiteTitle', '')`. */
  value<T>(section: keyof SiteConfigDocument, key: string, fallback: T): T {
    const bucket = this.doc()[section] as Record<string, any> | undefined;
    const v = bucket?.[key];
    return v === undefined || v === null ? fallback : (v as T);
  }

  /** Force a refetch — the customizer saves settings while the preview is open. */
  invalidate(): void {
    this.loaded = false;
    this.inFlight = null;
  }
}
