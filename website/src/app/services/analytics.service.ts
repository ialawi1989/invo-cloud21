import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { StorefrontTrackingSettings } from './marketing-tools.types';
import { PreviewService } from './preview.service';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Site-wide analytics — GA4 page views plus the Search Console / Meta domain
 * verification <head> tags. Applies to the WHOLE storefront (home, products,
 * collections, blog), so it lives at the app level, not inside the blog feature.
 *
 * `init()` is idempotent and called once after settings load (kicked off app-
 * wide so it covers every route). The editor preview (`?customize=true`) is
 * never tracked. Feature areas that want to record their own GA4 events (e.g.
 * the blog's post-click tracking) go through {@link event} rather than owning a
 * second gtag instance.
 *
 * Behaviour:
 *   • `gscVerification` / `facebookDomainVerification` set → render the
 *     verification <meta> (SSR-capable, independent of GA4).
 *   • `ga4MeasurementId` set → load gtag.js (browser only) and report page
 *     views on every navigation (SPA-aware; initial view included).
 * With no measurement id no gtag loads, so GA4 stays fully off.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser  = isPlatformBrowser(this.platformId);
  private doc        = inject(DOCUMENT);
  private router     = inject(Router);
  private preview    = inject(PreviewService);

  private measurementId: string | null = null;
  private started = false;

  /** True once GA4 is loaded, so callers can gate their own events. */
  get enabled(): boolean { return !!this.measurementId; }

  init(tracking: StorefrontTrackingSettings): void {
    if (this.started) return;
    // Never track or verify the dashboard's live-preview iframe.
    if (this.preview.isCustomizeMode()) return;
    this.started = true;

    // Verification tags are plain <head> meta tags — safe to write on the
    // server so they land in the SSR HTML the verifying crawler reads.
    this.applyVerificationMeta('google-site-verification', tracking.gscVerification);
    this.applyVerificationMeta('facebook-domain-verification', tracking.facebookDomainVerification);

    // GA4 is a client-side script; nothing to do during SSR.
    if (!this.isBrowser) return;

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

  /** Record a GA4 event. No-op unless GA4 is active — safe to call anywhere. */
  event(name: string, params?: Record<string, unknown>): void {
    this.gtag('event', name, params ?? {});
  }

  /** Idempotently write a `<meta name=… content=…>` verification tag to <head>. */
  private applyVerificationMeta(name: string, token?: string): void {
    const t = token?.trim();
    if (!t || !this.doc?.head) return;
    let meta = this.doc.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!meta) {
      meta = this.doc.createElement('meta');
      meta.setAttribute('name', name);
      this.doc.head.appendChild(meta);
    }
    meta.setAttribute('content', t);
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
