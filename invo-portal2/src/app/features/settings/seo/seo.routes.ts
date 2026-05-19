import { Routes } from '@angular/router';

/**
 * SEO Settings routes.
 *
 *   /settings/seo                  → landing (page-type catalog + site preferences)
 *   /settings/seo/:type            → editor for one page type
 *                                    (Edit-by-page tab + Customize-defaults tab)
 *
 * Both are lazy-loaded as standalone components — no module needed.
 */
export const SEO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/seo-landing/seo-landing.component').then(m => m.SeoLandingComponent),
  },
  {
    path: ':type',
    loadComponent: () =>
      import('./pages/seo-page-type/seo-page-type.component').then(m => m.SeoPageTypeComponent),
  },
];
