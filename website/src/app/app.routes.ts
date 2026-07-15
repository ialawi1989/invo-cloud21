import { Routes, CanMatchFn, CanActivateFn, Router, UrlSegment } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';

import { BLOG_ROUTES, BLOG_CHILDREN } from './features/blog/blog.routes';
import { BlogSettingsService } from './features/blog/services/blog-settings.service';

/**
 * Root route table — supports two URL structures (dashboard → Multilingual →
 * URL structure):
 *
 *   • subdirectory (default): every page under `/:lang/…` (`/en/blog`).
 *   • parameter: pages are lang-less and the language rides in `?lang=xx`
 *     (`/blog?lang=ar`). The DEFAULT language uses a clean URL with no param;
 *     only a non-default language adds `?lang=`.
 *
 * The active mode is read from settings. Parameter-mode routes are gated with
 * `canMatch: [isParamMode]` and declared first, so they win in parameter mode
 * and are skipped (falling through to the subdirectory routes) otherwise. On
 * the SERVER, settings aren't loaded (so SSR isn't blocked) — `isParamMode`
 * returns false there and the browser re-runs the guards after hydration.
 */

/** Pick the visitor's browser language when the site supports it. Browser-only
 *  (SSR has no `navigator`); returns null when nothing matches. */
function browserPreferredLang(supported: string[]): string | null {
  if (typeof navigator === 'undefined') return null;
  const prefs = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean);
  const set = new Set(supported);
  for (const p of prefs) {
    const code = String(p).toLowerCase().split('-')[0];
    if (set.has(code)) return code;
  }
  return null;
}

/**
 * Resolve the language to land a lang-less visitor on — honors the "Default
 * visitor language" and, when "auto-switch" is on, the browser language.
 * Browser-only auto-switch; the server returns a sync default so SSR isn't
 * blocked.
 */
async function defaultLang(): Promise<string> {
  const svc = inject(BlogSettingsService);
  const onServer = isPlatformServer(inject(PLATFORM_ID));
  if (!svc.loaded() && onServer) return 'en';
  let langs;
  try {
    langs = (svc.loaded() ? svc.settings() : await svc.load()).languages;
  } catch {
    return 'en';
  }
  if (langs.autoSwitch && !onServer) {
    const pref = browserPreferredLang(langs.supported);
    if (pref) return pref;
  }
  return langs.default;
}

/** True when the site encodes language as a `?lang=` query param. Assumed
 *  false on the server (settings not loaded) so SSR keeps subdirectory routing;
 *  the browser re-checks after hydration. */
const isParamMode: CanMatchFn = async () => {
  const svc = inject(BlogSettingsService);
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID))) return false;
  try {
    const s = svc.loaded() ? svc.settings() : await svc.load();
    return s.languages.urlStructure === 'parameter';
  } catch {
    return false;
  }
};

/** Query params of the URL currently being navigated to — carried through
 *  redirects so `?customize=true` / `?lang=` (and friends) aren't lost. */
function currentQueryParams(router: Router): Record<string, unknown> {
  return router.currentNavigation()?.initialUrl.queryParams ?? {};
}

const rootRedirect: CanMatchFn = async () => {
  const router = inject(Router);
  const queryParams = currentQueryParams(router);
  return router.createUrlTree([await defaultLang()], { queryParams });
};

/** Guard the storefront `:lang` segment (subdirectory mode). When the first
 *  segment is a supported language, render the page; otherwise it's a LEGACY
 *  lang-less link — prepend the default language, preserving path + query. */
const langGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const svc = inject(BlogSettingsService);
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID))) return true;
  const settings = await svc.load();
  const lang = route.paramMap.get('lang');
  if (lang && settings.languages.supported.includes(lang)) return true;
  return router.parseUrl(`/${settings.languages.default}${state.url}`);
};

/** Catch legacy lang-less links too DEEP for the `:lang/:page` routes and
 *  prepend the default language (subdirectory mode only). In parameter mode
 *  lang-less URLs are the norm, so an unmatched path is a genuine 404. */
const langlessRedirect: CanMatchFn = async (_route, segments: UrlSegment[]) => {
  if (!segments.length) return false;
  const router = inject(Router);
  const svc = inject(BlogSettingsService);
  if (!svc.loaded() && isPlatformServer(inject(PLATFORM_ID))) return false;
  const settings = svc.loaded() ? svc.settings() : await svc.load();
  if (settings.languages.urlStructure === 'parameter') return false;
  if (settings.languages.supported.includes(segments[0].path)) return false;
  return router.createUrlTree(
    [settings.languages.default, ...segments.map(s => s.path)],
    { queryParams: currentQueryParams(router) },
  );
};

export const APP_ROUTES: Routes = [
  // ── Parameter mode (lang in ?lang=, default is clean) ─────────────────
  // Declared first + gated on isParamMode so they win only in parameter mode.
  {
    path: '', pathMatch: 'full', canMatch: [isParamMode],
    loadComponent: () => import('./customizer-root.component').then(m => m.CustomizerRoot),
  },
  {
    path: 'blog', canMatch: [isParamMode],
    children: BLOG_CHILDREN,
  },
  {
    path: ':page', canMatch: [isParamMode],
    loadComponent: () => import('./customizer-root.component').then(m => m.CustomizerRoot),
  },

  // ── Subdirectory mode + lang-less entry points ────────────────────────
  { path: '', pathMatch: 'full', canMatch: [rootRedirect], children: [] },
  // Lang-less blog entry — render the DEFAULT language's blog directly at
  // `/blog` (no redirect to `/:lang/blog`). The blog pages resolve the active
  // language from the `:lang` segment / `?lang=` query, falling back to the
  // default when neither is present, so `/blog` serves the default language.
  { path: 'blog', children: BLOG_CHILDREN },

  // Blog at /:lang/blog/* — before ":lang/:page" so "blog" is never a page slug.
  ...BLOG_ROUTES,

  // Storefront home + arbitrary page (customizer canvas, CSR).
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

  // Legacy lang-less deep links → prepend default language (subdirectory only).
  { path: '**', canMatch: [langlessRedirect], children: [] },
  { path: '**', loadComponent: () => import('./features/blog/pages/not-found.component').then(m => m.NotFoundPage) },
];
