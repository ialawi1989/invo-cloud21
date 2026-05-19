import { RenderMode, ServerRoute } from '@angular/ssr';

// SSR render-mode table.
//
// The customizer at "/" MUST render client-side: it depends on
// `window`, `postMessage` from the dashboard iframe, and live DOM
// mutation by PreviewService — none of which exist during SSR.
//
// Everything else (blog, page-by-slug, future product/cart/etc.) is
// SSR'd so social/SEO crawlers see the Open Graph meta tags injected
// by the Express handlers in src/server.ts.
//
// NOTE: Angular 21 validates this table against provideRouter()'s
// route list at build time. When porting new features (cart, checkout,
// account, product detail, etc.) over from oldEco, ADD the entry here
// AT THE SAME TIME you add the route in app.routes.ts — otherwise the
// build will fail with "server route does not match any routes defined".
export const serverRoutes: ServerRoute[] = [
  // Customizer preview — must stay CSR.
  { path: '', renderMode: RenderMode.Client },

  // Everything else — SSR. The Express layer injects OG meta tags
  // for known routes; unknown ones fall through to Angular's
  // wildcard handler (NotFoundPage).
  { path: '**', renderMode: RenderMode.Server },
];
