import { Routes, CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { BLOG_ROUTES } from './features/blog/blog.routes';
import { BlogSettingsService } from './features/blog/services/blog-settings.service';

/**
 * Root route table.
 *
 * The legacy customizer preview lives at "/" (and "?customize=true").
 * Public blog routes live at "/:lang/blog/*" and load lazily, so the
 * customizer bundle stays small for users who never click into the
 * blog. Lang-less "/blog" hits the redirect matcher below and lands
 * on "/<defaultLang>/blog".
 */

const blogRedirectMatcher: CanMatchFn = async () => {
  const router = inject(Router);
  try {
    const s = await inject(BlogSettingsService).load();
    return router.parseUrl(`/${s.languages.default}/blog`);
  } catch {
    // Backend settings unavailable — fall back to a hardcoded default
    // language so `/blog` always lands somewhere instead of stalling
    // SSR and returning an Express 404.
    return router.parseUrl('/en/blog');
  }
};

export const AAPP_ROUTES: Routes = [
  ...BLOG_ROUTES,
  {
    path: 'blog',
    canMatch: [blogRedirectMatcher],
    children: [],
  },
  { path: '', loadComponent: () => import('./customizer-root.component').then(m => m.CustomizerRoot) },
  { path: '**', loadComponent: () => import('./features/blog/pages/not-found.component').then(m => m.NotFoundPage) },
];
