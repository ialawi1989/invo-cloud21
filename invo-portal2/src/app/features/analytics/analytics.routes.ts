import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('analytics');
  return true;
};

/**
 * Store-wide Analytics feature. Mounted at `/analytics`, surfaced under the
 * Website Content sidebar group. Surfaces GA4 traffic + e-commerce + realtime
 * and GSC search for the whole site — distinct from the blog-scoped
 * `/blog/analytics`.
 *
 * Gated by its own website-area privilege `websiteAnalyticsSecurity.actions.view.access`
 * (a dedicated node under the Website security group — backend must expose it).
 */
export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'websiteAnalyticsSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/overview/site-analytics.component').then(m => m.SiteAnalyticsComponent),
  },
];
