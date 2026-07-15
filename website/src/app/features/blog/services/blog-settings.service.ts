import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PublicBlogApiService } from './public-blog-api.service';
import { BlogAnalyticsService } from './blog-analytics.service';
import { MarketingToolsService } from '../../../services/marketing-tools.service';
import { PublicBlogSettings, defaultPublicBlogSettings } from '../models/blog-settings.types';
import { environment } from '../../../../environments/environment';

/**
 * One-shot settings cache. Public blog settings barely change, so we
 * load them once per session and reuse the value everywhere. Pages
 * await `load()` on mount; concurrent callers share the same promise
 * so we only ever fire one network request.
 */
@Injectable({ providedIn: 'root' })
export class BlogSettingsService {
  private api = inject(PublicBlogApiService);
  private analytics = inject(BlogAnalyticsService);
  private marketing = inject(MarketingToolsService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private _settings = signal<PublicBlogSettings>(defaultPublicBlogSettings());
  private _loaded   = signal<boolean>(false);
  private inflight: Promise<PublicBlogSettings> | null = null;

  settings = this._settings.asReadonly();
  loaded   = this._loaded.asReadonly();

  load(): Promise<PublicBlogSettings> {
    if (this._loaded()) return Promise.resolve(this._settings());
    if (this.inflight)  return this.inflight;
    this.inflight = (async () => {
      try {
        const s = await this.api.getPublicSettings();
        this._settings.set(s);
        this._loaded.set(true);
        // Site-wide tracking: GA4 / Search Console, plus the Marketing
        // Tools plugins (Google Tag + Facebook Pixel). Both cover every
        // storefront route, not just blog pages.
        this.analytics.init(s.tracking);
        this.marketing.init(s.tracking);
        return s;
      } catch {
        // Backend unavailable (no slug, endpoint not deployed, network
        // error) — fall back to safe defaults so SSR can still finish
        // rendering the page chrome instead of crashing with an
        // unhandled promise rejection and a stock Express 404.
        const fallback = defaultPublicBlogSettings();
        this._settings.set(fallback);
        this._loaded.set(true);
        return fallback;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  isRtl(lang: string): boolean {
    return this._settings().languages.rtlLanguages.includes(lang);
  }

  /** Absolute storefront origin for canonical / og:url. Prefers the
   *  backend-provided `siteUrl`, then the build-time origin, then the
   *  live browser origin (empty on the server when nothing is set). */
  originUrl(): string {
    return this._settings().siteUrl
      || environment.siteOrigin
      || (this.isBrowser ? window.location.origin : '');
  }

  /** Path segments after the origin for a blog URL. The DEFAULT language is
   *  served at the clean, lang-less path (`/blog/...`); every OTHER language
   *  keeps its `/:lang` prefix (`/ar/blog/...`). Parameter mode is always
   *  lang-less (language rides in `?lang=`). Single source of truth so the
   *  route table (app.routes.ts), internal links, and canonical/hreflang URLs
   *  all agree. */
  private blogParts(lang: string, segments: (string | number)[]): string[] {
    const langs = this._settings().languages;
    const langless = langs.urlStructure === 'parameter' || lang === langs.default;
    const base = langless ? ['blog'] : [lang, 'blog'];
    return [...base, ...segments.map(String)];
  }

  /** Router `routerLink`/`navigate` commands for a blog URL — see `blogParts`. */
  blogLink(lang: string, ...segments: (string | number)[]): string[] {
    return ['/', ...this.blogParts(lang, segments)];
  }

  /** Absolute blog URL (origin + path) for canonical / og:url / hreflang. */
  blogUrl(lang: string, ...segments: (string | number)[]): string {
    return `${this.originUrl()}/${this.blogParts(lang, segments).join('/')}`;
  }
}
