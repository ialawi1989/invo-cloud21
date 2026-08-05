import { RenderMode, ServerRoute } from '@angular/ssr';

// SSR render-mode table.
//
// The customizer canvas (storefront home "/:lang" and any "/:lang/:page")
// MUST render client-side: it depends on `window`, `postMessage` from the
// dashboard iframe, and live DOM mutation by PreviewService — none of
// which exist during SSR.
//
// Blog routes are SSR'd so social/SEO crawlers see the Open Graph meta
// tags injected by BlogSeoService / the Express handlers in server.ts.
//
// NOTE: Angular 21 validates this table against provideRouter()'s route
// list at build time. When porting new features (cart, checkout, account,
// product detail, etc.) over from oldEco, ADD the entry here AT THE SAME
// TIME you add the route in app.routes.ts — otherwise the build fails
// with "server route does not match any routes defined". Blog entries
// must stay listed BEFORE the catch-all ":lang/:page" so a blog URL is
// never downgraded to the client-rendered customizer.
export const serverRoutes: ServerRoute[] = [
  // Home — CSR (customizer canvas in parameter mode; lang-less redirect in
  // subdirectory mode).
  { path: '', renderMode: RenderMode.Client },

  // Parameter-mode blog (lang-less, ?lang=) — SSR for SEO/crawlers.
  { path: 'blog', renderMode: RenderMode.Server },
  { path: 'blog/search', renderMode: RenderMode.Server },
  { path: 'blog/category/:categorySlug', renderMode: RenderMode.Server },
  { path: 'blog/tag/:tagSlug', renderMode: RenderMode.Server },
  { path: 'blog/authors/:authorEmployeeId', renderMode: RenderMode.Server },
  { path: 'blog/:slug', renderMode: RenderMode.Server },

  // Subdirectory-mode blog — SSR for SEO/crawlers.
  { path: ':lang/blog', renderMode: RenderMode.Server },
  { path: ':lang/blog/search', renderMode: RenderMode.Server },
  { path: ':lang/blog/category/:categorySlug', renderMode: RenderMode.Server },
  { path: ':lang/blog/tag/:tagSlug', renderMode: RenderMode.Server },
  { path: ':lang/blog/authors/:authorEmployeeId', renderMode: RenderMode.Server },
  { path: ':lang/blog/:slug', renderMode: RenderMode.Server },

  // Product detail — SSR so the Express meta-tag injection in server.ts has a
  // rendered document to inject into, and crawlers get the OG/Twitter tags.
  // Must stay BEFORE the `:page` / `:lang/:page` entries.
  { path: 'product/:key', renderMode: RenderMode.Server },
  { path: ':lang/product/:key', renderMode: RenderMode.Server },

  // Legacy provenance-in-path URLs — SSR'd so a crawler following an old link
  // is redirected rather than served an empty client shell.
  { path: ':parent/product/:key', renderMode: RenderMode.Server },
  { path: ':lang/:parent/product/:key', renderMode: RenderMode.Server },

  // Home stays CSR — it's the customizer canvas, which needs `window` and
  // postMessage. `:page` / `:lang/:page` now go through PageHost, which may
  // render a product listing, so they are SSR'd for SEO; PageHost renders the
  // canvas immediately (without waiting on the network) when the dashboard is
  // driving the page, so the editor is unaffected.
  { path: ':lang', renderMode: RenderMode.Client },
  { path: ':page', renderMode: RenderMode.Server },
  { path: ':lang/:page', renderMode: RenderMode.Server },

  // Everything else (not-found, etc.) — SSR.
  { path: '**', renderMode: RenderMode.Server },
];
