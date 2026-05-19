import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { BlogSettingsService } from './services/blog-settings.service';

/**
 * Guard: ensure the `:lang` segment is one of the configured
 * supported languages. Unknown codes redirect to the blog index in
 * the configured default language. Settings load is a single shared
 * promise so this guard never re-fetches.
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

export const BLOG_ROUTES: Routes = [
  {
    path: ':lang/blog',
    canActivate: [langGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/blog-index.component').then(m => m.BlogIndexPage),
      },
      {
        path: 'search',
        loadComponent: () => import('./pages/search.component').then(m => m.SearchPage),
      },
      {
        path: 'category/:categorySlug',
        loadComponent: () => import('./pages/category.component').then(m => m.CategoryPage),
      },
      {
        path: 'tag/:tagSlug',
        loadComponent: () => import('./pages/tag.component').then(m => m.TagPage),
      },
      {
        path: 'authors/:authorEmployeeId',
        loadComponent: () => import('./pages/author.component').then(m => m.AuthorPage),
      },
      {
        path: ':slug',
        loadComponent: () => import('./pages/post.component').then(m => m.PostPage),
      },
    ],
  },
];
