import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { PublicBlogTrackingSettings } from '../models/blog-settings.types';
import { PreviewService } from '../../../services/preview.service';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Site-wide analytics, driven by the blog's `tracking` settings.
 * `init()` is idempotent and called once after settings load (kicked
 * off app-wide so it covers every route, not just blog pages). The
 * editor preview (`?customize=true`) is never tracked.
 *
 * Behaviour:
 *   • `gscVerification` set   → render the Search Console verification
 *     <meta> (SSR-capable, independent of GA4).
 *   • `ga4MeasurementId` set  → load gtag.js (browser only) and report
 *     page views on every navigation (SPA-aware; initial view included).
 *   • `clicksEnabled` true    → post/link clicks fire `select_content`.
 * With no measurement id no gtag loads, so GA4 stays fully off.
 */
@Injectable({ providedIn: 'root' })
export class BlogAnalyticsService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser  = isPlatformBrowser(this.platformId);
  private doc        = inject(DOCUMENT);
  private router     = inject(Router);
  private preview    = inject(PreviewService);

  private measurementId: string | null = null;
  private clicksEnabled = false;
  private started = false;

  init(tracking: PublicBlogTrackingSettings): void {
    if (this.started) return;
    // Never track or verify the dashboard's live-preview iframe.
    if (this.preview.isCustomizeMode()) return;
    this.started = true;

    // GSC verification is a plain <head> tag — safe to write on the
    // server so it lands in the SSR HTML the crawler reads.
    this.applyGscVerification(tracking.gscVerification);

    // GA4 is a client-side script; nothing to do during SSR.
    if (!this.isBrowser) return;
    this.clicksEnabled = !!tracking.clicksEnabled;

    const id = tracking.ga4MeasurementId?.trim();
    if (!id) return; // no measurement id → GA4 stays off
    this.measurementId = id;

    this.loadGtag(id);
    // Send the page we're already on, then every subsequent navigation.
    this.sendPageView(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.sendPageView(e.urlAfterRedirects));
  }

  private applyGscVerification(token?: string): void {
    const t = token?.trim();
    if (!t || !this.doc?.head) return;
    let meta = this.doc.head.querySelector<HTMLMetaElement>('meta[name="google-site-verification"]');
    if (!meta) {
      meta = this.doc.createElement('meta');
      meta.setAttribute('name', 'google-site-verification');
      this.doc.head.appendChild(meta);
    }
    meta.setAttribute('content', t);
  }

  /** Fire a GA4 content-selection event for a clicked post. Gated on
   *  `clicksEnabled`; safe to call unconditionally from templates. */
  trackPostClick(post: { slug: string; title: string }): void {
    if (!this.clicksEnabled) return;
    this.gtag('event', 'select_content', {
      content_type: 'blog_post',
      item_id:      post.slug,
      item_name:    post.title,
    });
  }

  private loadGtag(id: string): void {
    const w = this.doc.defaultView as (Window & typeof globalThis) | null;
    if (!w) return;
    w.dataLayer = w.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    w.gtag = w.gtag || function gtag() { w.dataLayer!.push(arguments); };
    w.gtag('js', new Date());
    // We send page views ourselves so SPA navigations are counted and
    // the first view isn't double-fired.
    w.gtag('config', id, { send_page_view: false });

    const s = this.doc.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    this.doc.head.appendChild(s);
  }

  private sendPageView(path: string): void {
    this.gtag('event', 'page_view', {
      page_path:     path,
      page_location: this.doc.location?.href,
      page_title:    this.doc.title,
    });
  }

  private gtag(...args: unknown[]): void {
    if (!this.isBrowser || !this.measurementId) return;
    this.doc.defaultView?.gtag?.(...args);
  }
}
