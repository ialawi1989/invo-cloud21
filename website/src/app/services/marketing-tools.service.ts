import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { PublicBlogTrackingSettings } from '../features/blog/models/blog-settings.types';
import { PreviewService } from './preview.service';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

/**
 * Injects the **Marketing Tools** plugins — Google Tag / Tag Manager and the
 * Facebook (Meta) Pixel — across the ENTIRE storefront (every route, not just
 * the blog). Driven by the storefront's public `tracking` settings.
 *
 * Mirrors {@link BlogAnalyticsService}: `init()` is idempotent, runs once
 * after settings load, browser-only (the snippets are client-side), and never
 * fires inside the dashboard's live-preview iframe.
 *
 * Behaviour:
 *   • `googleTagId` set     → inject Google Tag Manager (GTM-…) or gtag.js
 *     (GT-/G-/AW-…). SPA route changes push a `gtm.historyChange` /
 *     `page_view` so navigations are counted.
 *   • `facebookPixelId` set → inject the Meta Pixel and fire `PageView` on
 *     every navigation.
 * With neither id present, nothing loads.
 */
@Injectable({ providedIn: 'root' })
export class MarketingToolsService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser  = isPlatformBrowser(this.platformId);
  private doc        = inject(DOCUMENT);
  private router     = inject(Router);
  private preview    = inject(PreviewService);

  private started = false;
  private gtagLoaded = false;
  private gtagKind: 'gtm' | 'gtag' | null = null;
  private googleTagId: string | null = null;
  private pixelId: string | null = null;

  init(tracking: PublicBlogTrackingSettings): void {
    if (this.started) return;
    // Never inject marketing tags into the dashboard's live-preview iframe.
    if (this.preview.isCustomizeMode()) return;
    // Snippets are client-side; nothing to do during SSR.
    if (!this.isBrowser) return;
    this.started = true;

    const gId = tracking.googleTagId?.trim();
    // Skip when the Google Tag id is the same G- id GA4 already loads, so
    // we don't double-inject gtag.js for one measurement id.
    if (gId && gId !== tracking.ga4MeasurementId?.trim()) {
      this.googleTagId = gId;
      this.loadGoogleTag(gId);
    }

    const pId = tracking.facebookPixelId?.trim();
    if (pId) {
      this.pixelId = pId;
      this.loadFacebookPixel(pId);
    }

    if (!this.googleTagId && !this.pixelId) return;

    // Report SPA navigations to whichever tools are active.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.onNavigation(e.urlAfterRedirects));
  }

  // ── Google Tag ───────────────────────────────────────────────────────

  private loadGoogleTag(id: string): void {
    const w = this.doc.defaultView as (Window & typeof globalThis) | null;
    if (!w || this.gtagLoaded) return;
    this.gtagLoaded = true;

    if (/^GTM-/i.test(id)) {
      this.gtagKind = 'gtm';
      // Standard Google Tag Manager container snippet.
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const s = this.doc.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
      this.doc.head.appendChild(s);
      this.addGtmNoscript(id);
    } else {
      this.gtagKind = 'gtag';
      // Single Google tag (GT-/G-/AW-) via gtag.js.
      w.dataLayer = w.dataLayer || [];
      // eslint-disable-next-line prefer-rest-params
      w.gtag = w.gtag || function gtag() { w.dataLayer!.push(arguments); };
      w.gtag('js', new Date());
      w.gtag('config', id);
      const s = this.doc.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      this.doc.head.appendChild(s);
    }
  }

  /** GTM's <noscript> fallback iframe, injected at the top of <body>. */
  private addGtmNoscript(id: string): void {
    const ns = this.doc.createElement('noscript');
    const iframe = this.doc.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    ns.appendChild(iframe);
    this.doc.body?.insertBefore(ns, this.doc.body.firstChild);
  }

  // ── Facebook (Meta) Pixel ────────────────────────────────────────────

  private loadFacebookPixel(id: string): void {
    const w = this.doc.defaultView as (Window & typeof globalThis) | null;
    if (!w) return;

    // Standard Meta Pixel bootstrap (the `fbq` stub that queues calls
    // until the real library loads).
    if (!w.fbq) {
      const n: any = (w.fbq = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue!.push(args);
      });
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const s = this.doc.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      this.doc.head.appendChild(s);
    }

    w.fbq!('init', id);
    w.fbq!('track', 'PageView');
    this.addFbPixelNoscript(id);
  }

  /** Meta Pixel's <noscript> tracking image. */
  private addFbPixelNoscript(id: string): void {
    const ns = this.doc.createElement('noscript');
    const img = this.doc.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`;
    ns.appendChild(img);
    this.doc.body?.appendChild(ns);
  }

  // ── SPA navigation ───────────────────────────────────────────────────

  private onNavigation(path: string): void {
    const w = this.doc.defaultView as (Window & typeof globalThis) | null;
    if (!w) return;
    if (this.googleTagId) {
      if (this.gtagKind === 'gtm') {
        w.dataLayer?.push({ event: 'gtm.historyChange', 'gtm.newUrl': this.doc.location?.href });
      } else {
        w.gtag?.('event', 'page_view', {
          page_path:     path,
          page_location: this.doc.location?.href,
          page_title:    this.doc.title,
        });
      }
    }
    if (this.pixelId) {
      w.fbq?.('track', 'PageView');
    }
  }
}
