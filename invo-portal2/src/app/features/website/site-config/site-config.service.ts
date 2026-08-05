import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** Sections of the site-config document, and the legacy row each persists to
 *  (kept here as documentation — the backend owns the mapping). */
export type SiteConfigSection =
  | 'branding'   // ThemeSettings: websiteTitle, logos, colors, typography, buttons, inputs, background, schemes, media
  | 'layout'     // ThemeSettings: layout, header, footer, promotionBanners, productCards
  | 'contact'    // ThemeSettings: contactInformation, socialmedia
  | 'commerce'   // ThemeSettings: shippingOptions, enforceServiceSelection, serviceMenus, promo, deliveryAreaType, other
  | 'seo'        // SeoSettings
  | 'blog';      // BlogSettings

export interface SiteConfigDocument {
  version: string;
  seeded:  boolean;
  branding: Record<string, any>;
  layout:   Record<string, any>;
  contact:  Record<string, any>;
  commerce: Record<string, any>;
  seo:      Record<string, any>;
  blog:     Record<string, any>;
  navigation: { primaryMenuId: string | null; footerMenuId: string | null; hasMobileIconBar: boolean };
  /** ThemeSettings keys not claimed by a section — preserved so a round-trip
   *  through this API can't drop data. */
  extra: Record<string, any>;
}

const EMPTY: SiteConfigDocument = {
  version: '0', seeded: true,
  branding: {}, layout: {}, contact: {}, commerce: {}, seo: {}, blog: {},
  navigation: { primaryMenuId: null, footerMenuId: null, hasMobileIconBar: false },
  extra: {},
};

/**
 * Website settings as one document instead of four blobs.
 *
 * Before: the theme came from `company/getThemeByType {type:'ThemeSettings'}`,
 * SEO from the same endpoint with a different type, blog settings from their
 * own service — three calls, three shapes, and every page had to know which
 * blob its field lived in.
 *
 * The backend assembles the document from those same rows and writes a section
 * back to its own row, so this is a nicer surface over one source of truth, not
 * a second copy. `save()` returns the reassembled document, so callers never
 * re-read.
 */
@Injectable({ providedIn: 'root' })
export class SiteConfigService {
  private api = inject(ApiService);

  private doc = signal<SiteConfigDocument>(EMPTY);
  private loaded = false;
  private inFlight: Promise<SiteConfigDocument> | null = null;

  config = this.doc.asReadonly();

  branding = computed(() => this.doc().branding);
  layout   = computed(() => this.doc().layout);
  contact  = computed(() => this.doc().contact);
  commerce = computed(() => this.doc().commerce);
  seo      = computed(() => this.doc().seo);
  blog     = computed(() => this.doc().blog);

  /** True while the company has no theme row — the UI should offer to seed
   *  rather than present empty fields as if they were choices. */
  isSeeded = computed(() => this.doc().seeded);

  async load(force = false): Promise<SiteConfigDocument> {
    if (this.loaded && !force) return this.doc();
    return (this.inFlight ??= this.doFetch());
  }

  private async doFetch(): Promise<SiteConfigDocument> {
    try {
      const res = await this.api.request<any>(this.api.get('website/siteConfig'));
      if (res?.data) this.doc.set({ ...EMPTY, ...res.data });
    } catch {
      // Endpoint not mounted yet — callers keep their existing fallbacks.
    } finally {
      this.loaded = true;
      this.inFlight = null;
    }
    return this.doc();
  }

  /**
   * Merge a patch into one section.
   *
   * Shallow merge, by design: these blobs are edited as whole objects, and a
   * deep merge would make clearing a key (removing a logo) impossible. Send the
   * full sub-object you intend to persist.
   */
  async save(section: SiteConfigSection, patch: Record<string, any>): Promise<SiteConfigDocument> {
    const res = await this.api.request<any>(
      this.api.post(`website/siteConfig/${section}`, { patch }),
    );
    if (res?.data) this.doc.set({ ...EMPTY, ...res.data });
    return this.doc();
  }

  /** Read one value with a fallback: `value('commerce', 'shippingOptions', {})`. */
  value<T>(section: SiteConfigSection, key: string, fallback: T): T {
    const bucket = this.doc()[section] as Record<string, any> | undefined;
    const v = bucket?.[key];
    return v === undefined || v === null ? fallback : (v as T);
  }
}
