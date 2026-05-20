import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

import { BLOG_API_PROVIDERS } from './services/blog-api.providers';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('blog');
  return true;
};

/**
 * Standalone routes for the Wix-style post composer. Registered at
 * the TOP level of the app (not under MainLayoutComponent), so the
 * editor takes over the full viewport with no surrounding admin
 * chrome — same pattern as receipt-builder / document-builder /
 * label-builder. Provides the same `BLOG_API` token the rest of the
 * blog feature expects.
 */
export const BLOG_COMPOSER_ROUTES: Routes = [
  {
    path: '',
    providers: BLOG_API_PROVIDERS,
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'blogSecurity.actions.managePosts.access' },
    loadComponent: () =>
      import('./pages/post-composer/post-composer.component').then(m => m.PostComposerComponent),
  },
];
