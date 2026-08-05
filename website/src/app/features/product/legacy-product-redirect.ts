import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Legacy product URL → canonical, preserving where the visitor came from.
 *
 * The old storefront put provenance in the path and picked it by sniffing the
 * current URL, so one product had five addresses:
 *
 *     /menu/product/:id   /shop/product/:id   /collections/product/:id
 *     /search/product/:id /products/product/:id
 *
 * …none of which the product page ever read, which is why Back and breadcrumbs
 * couldn't tell where you'd been. Identity now lives in the path and provenance
 * in the query, so those five collapse to one indexable URL:
 *
 *     /:lang/product/:key?from=<listing-slug>
 *
 * `replaceUrl` keeps the dead URL out of history, so Back from the product page
 * lands on the listing rather than bouncing through the redirect.
 *
 * NOTE: this is a client-side redirect. For crawlers and shared links a real
 * 301 belongs in `server.ts` — the Express layer already intercepts the
 * wildcard product path for meta tags and is the right place for it.
 */
@Component({
  selector: 'app-legacy-product-redirect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class LegacyProductRedirect implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit(): void {
    const snap   = this.route.snapshot;
    const key    = snap.paramMap.get('key') ?? '';
    const lang   = snap.paramMap.get('lang');
    const parent = snap.paramMap.get('parent') ?? '';

    const path = lang ? ['/', lang, 'product', key] : ['/', 'product', key];

    void this.router.navigate(path, {
      queryParams: {
        ...snap.queryParams,
        // Don't invent provenance: `products` was the catch-all fallback, not a
        // real listing the visitor came from.
        from: snap.queryParams['from'] ?? (parent && parent !== 'products' ? parent : undefined),
      },
      replaceUrl: true,
    });
  }
}
