import { Routes, CanMatchFn, CanActivateFn, Router, UrlSegment } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';

import { BLOG_ROUTES } from './features/blog/blog.routes';
import { BlogSettingsService } from './features/blog/services/blog-settings.service';

/**
 * Root route table.
 *
 * Every page lives under a language segment: `/:lang`, `/:lang/:page`,
 * and `/:lang/blog/*`. The two lang-less entry points ("/" and
 * "/blog") redirect into the default language, **preserving query
 * params** so the customizer's `?customize=true` survives the hop and
 * the preview iframe keeps working.
 *
 * The customizer canvas (home + arbitrary `:page`) is postMessage /
 * window-driven, so those routes render client-side — see
 * app.routes.server.ts. Blog routes stay SSR for SEO/crawlers.
 */

/** Resolve the configured default language for a redirect.
 *
 *  These redirect targets (`/` and `/blog`) are client-rendered, so on
 *  the SERVER we must NOT kick off the settings HTTP fetch — a pending
 *  request there keeps SSR from stabilising (and hangs for the full
 *  timeout when the backend is slow/unreachable). Return a sync default
 *  on the server; the browser re-runs the guard and lands on the real
 *  configured default. Reuse the cached value when it's already loaded. */
async function defaultLang(): Promise<string> {
  const svc = inject(BlogSettingsService);
  if (svc.loaded()) return svc.settings().languages.default;
  if (isPlatformServer(inject(PLATFORM_ID))) return 'en';
  try {
    return (await svc.load()).languages.default;
  } catch {
    return 'en';
  }
}

/** Query params of the URL currently being navigated to — carried
 *  through redirects so `?customize=true` (and friends) aren't lost. */
function currentQueryParams(router: Router): Record<string, unknown> {
  return router.currentNavigation()?.initialUrl.queryParams ?? {};
}

const rootRedirect: CanMatchFn = async () => {
  const router = inject(Router);
  const queryParams = currentQueryParams(router);
  return router.createUrlTree([await defaultLang()], { queryParams });
};

const blogRedirect: CanMatchFn = async () => {
  const router = inject(Router);
  const queryParams = currentQueryParams(router);
  return router.createUrlTree([await defaultLang(), 'blog'], { queryParams });
};

/** Guard the storefront `:lang` segment.
 *
 *  When the first segment is a supported language, render the page.
 *  Otherwise it's a LEGACY lang-less link (e.g. the old storefront's
 *  `/menu?branch_id=…`): prepend the default language and redirect,
 *  **preserving the full path AND query** — so `/menu?branch_id=…`
 *  becomes `/en/menu?branch_id=…` instead of dropping to a bare `/en`. */
const langGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const svc = inject(BlogSettingsService);
  // These pages are client-rendered. On the server, don't block SSR on a
  // settings fetch — allow through and let the browser validate after
  // hydration (it re-runs this guard with the loaded settings).
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID))) return true;
  const settings = await svc.load();
  const lang = route.paramMap.get('lang');
  if (lang && settings.languages.supported.includes(lang)) return true;
  // state.url is the whole requested URL ("/menu?branch_id=…"); prefixing
  // it keeps the path + every query param intact.
  return router.parseUrl(`/${settings.languages.default}${state.url}`);
};

/** Catch legacy lang-less links too DEEP for the `:lang/:page` routes
 *  (3+ segments) and prepend the default language, preserving path +
 *  query. Returns false → falls through to NotFound when the first
 *  segment IS already a supported language (a real 404), or on the
 *  server when settings aren't loaded yet (the browser re-checks). */
const langlessRedirect: CanMatchFn = async (_route, segments: UrlSegment[]) => {
  if (!segments.length) return false;
  const router = inject(Router);
  const svc = inject(BlogSettingsService);
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID))) return false;
  const settings = svc.loaded() ? svc.settings() : await svc.load();
  if (settings.languages.supported.includes(segments[0].path)) return false;
  return router.createUrlTree(
    [settings.languages.default, ...segments.map(s => s.path)],
    { queryParams: currentQueryParams(router) },
  );
};

export const APP_ROUTES: Routes = [
  // Lang-less entry points → redirect into the default language.
  { path: '', pathMatch: 'full', canMatch: [rootRedirect], children: [] },
  { path: 'blog', canMatch: [blogRedirect], children: [] },

  // Blog at /:lang/blog/* — declared before ":lang/:page" so "blog" is
  // never mistaken for a page slug.
  ...BLOG_ROUTES,

  // Storefront home + arbitrary page, both rendered by the customizer
  // canvas (CSR — see app.routes.server.ts).
  {
    path: ':lang',
    canActivate: [langGuard],
    loadComponent: () => import('./customizer-root.component').then(m => m.CustomizerRoot),
  },
  {
    path: ':lang/:page',
    canActivate: [langGuard],
    loadComponent: () => import('./customizer-root.component').then(m => m.CustomizerRoot),
  },

  // Legacy lang-less deep links → prepend default language (path + query
  // preserved). Falls through to NotFound for genuine 404s.
  { path: '**', canMatch: [langlessRedirect], children: [] },
  { path: '**', loadComponent: () => import('./features/blog/pages/not-found.component').then(m => m.NotFoundPage) },
];
