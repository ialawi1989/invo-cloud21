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
  // Lang-less redirects resolve the default language at runtime — CSR.
  { path: '', renderMode: RenderMode.Client },

  // Blog — SSR for SEO/crawlers.
  { path: ':lang/blog', renderMode: RenderMode.Server },
  { path: ':lang/blog/search', renderMode: RenderMode.Server },
  { path: ':lang/blog/category/:categorySlug', renderMode: RenderMode.Server },
  { path: ':lang/blog/tag/:tagSlug', renderMode: RenderMode.Server },
  { path: ':lang/blog/authors/:authorEmployeeId', renderMode: RenderMode.Server },
  { path: ':lang/blog/:slug', renderMode: RenderMode.Server },

  // Customizer canvas (home + arbitrary page) — must stay CSR.
  { path: ':lang', renderMode: RenderMode.Client },
  { path: ':lang/:page', renderMode: RenderMode.Client },

  // Everything else (lang-less "/blog" redirect, not-found, etc.) — SSR.
  { path: '**', renderMode: RenderMode.Server },
];
