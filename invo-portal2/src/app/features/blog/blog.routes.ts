import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { privilegeGuard } from '@core/guards/privilege.guard';

import { BLOG_API_PROVIDERS } from './services/blog-api.providers';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('blog');
  return true;
};

/**
 * Blog feature routes. Mounted at `/blog/*` (top-level — not nested under
 * `/settings`) so the section gets its own sidebar group.
 *
 * Each route is privilege-gated via `privilegeGuard` against the tree-shape
 * privileges the backend returns on login (see `blogSecurity` definition).
 * Switch the mock API to the real one in `services/blog-api.service.ts`
 * when the backend ships — none of these route files need to change.
 */
export const BLOG_ROUTES: Routes = [
  {
    path: '',
    // Route-level providers — scope `BLOG_API` (and its mock/http impls)
    // to the blog feature. Swap mock → http by editing the providers file.
    providers: BLOG_API_PROVIDERS,
    children: [
      { path: '', redirectTo: 'posts', pathMatch: 'full' },

  // ── Posts ─────────────────────────────────────────────────────────────
  {
    path: 'posts',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'blogSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/posts-list/posts-list.component').then(m => m.PostsListComponent),
  },
  {
    path: 'posts/new',
    canActivate:   [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'blogSecurity.actions.managePosts.access' },
    loadComponent: () =>
      import('./pages/post-composer/post-composer.component').then(m => m.PostComposerComponent),
  },
  {
    path: 'posts/:id/edit',
    canActivate:   [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'blogSecurity.actions.managePosts.access' },
    loadComponent: () =>
      import('./pages/post-composer/post-composer.component').then(m => m.PostComposerComponent),
  },

  // ── Categories & Tags ─────────────────────────────────────────────────
  {
    path: 'categories',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'blogSecurity.actions.manageCategories.access' },
    loadComponent: () =>
      import('./pages/taxonomies/taxonomies.component').then(m => m.TaxonomiesComponent),
  },

  // ── Comments ──────────────────────────────────────────────────────────
  {
    path: 'comments',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'blogSecurity.actions.moderateComments.access' },
    loadComponent: () =>
      import('./pages/comments/comments.component').then(m => m.CommentsComponent),
  },

  // ── Settings ──────────────────────────────────────────────────────────
  {
    path: 'settings',
    canActivate:   [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'blogSecurity.actions.manageSettings.access' },
    loadComponent: () =>
      import('./pages/blog-settings/blog-settings.component').then(m => m.BlogSettingsComponent),
  },
    ],
  },
];
