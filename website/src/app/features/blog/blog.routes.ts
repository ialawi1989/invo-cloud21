import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { BlogSettingsService } from './services/blog-settings.service';

/**
 * Blog child routes — shared by both URL structures:
 *   • subdirectory: `/:lang/blog/*`
 *   • parameter:    `/blog/*?lang=xx`
 * so the same lazy pages serve both. The active language is read from the
 * path segment or the `?lang=` query by each page (see `activeLangFromRoute`).
 */
export const BLOG_CHILDREN: Routes = [
  { path: '',                        loadComponent: () => import('./pages/blog-index.component').then(m => m.BlogIndexPage) },
  { path: 'search',                  loadComponent: () => import('./pages/search.component').then(m => m.SearchPage) },
  { path: 'category/:categorySlug',  loadComponent: () => import('./pages/category.component').then(m => m.CategoryPage) },
  { path: 'tag/:tagSlug',            loadComponent: () => import('./pages/tag.component').then(m => m.TagPage) },
  { path: 'authors/:authorEmployeeId', loadComponent: () => import('./pages/author.component').then(m => m.AuthorPage) },
  { path: ':slug',                   loadComponent: () => import('./pages/post.component').then(m => m.PostPage) },
];

/**
 * Subdirectory guard: ensure the `:lang` segment is one of the configured
 * supported languages. Unknown codes redirect to the blog index in the
 * configured default language. Settings load is a single shared promise so
 * this guard never re-fetches.
 */
const langGuard: CanActivateFn = async (route) => {
  const settings = await inject(BlogSettingsService).load();
  const lang = route.paramMap.get('lang');
  const supported = settings.languages.supported;
  if (!lang || !supported.includes(lang)) {
    inject(Router).navigateByUrl(`/${settings.languages.default}/blog`);
    return false;
  }
  return true;
};

/** Subdirectory blog routes (`/:lang/blog/*`). Parameter-mode blog routes are
 *  declared in `app.routes.ts` reusing `BLOG_CHILDREN`. */
export const BLOG_ROUTES: Routes = [
  {
    path: ':lang/blog',
    canActivate: [langGuard],
    children: BLOG_CHILDREN,
  },
];
