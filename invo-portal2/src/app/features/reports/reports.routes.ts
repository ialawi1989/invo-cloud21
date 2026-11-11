import { inject } from '@angular/core';
import { CanActivateFn, Routes, UrlMatcher } from '@angular/router';
import { findBoReport } from './business-overview/config/business-overview.config';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /reports                 → the reports catalog (cards + tabs + search)
// /reports/view/:slug      → a single report (generic shell, driven by catalog)
// ─────────────────────────────────────────────────────────────────────────────

/** Preload the `reports` translation namespace before rendering. */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('reports');
  return true;
};

/**
 * Business Overview reports have dedicated pages (accounting statements with
 * comparison columns and drill-down) instead of the generic flat-table shell.
 *   view/:slug                  → the statement
 *   view/:slug/account-journals → drill-down into one account
 * Must come before the generic `view/:slug` route.
 */
const businessOverviewMatcher: UrlMatcher = segments => {
  if (segments[0]?.path !== 'view' || !segments[1] || !findBoReport(segments[1].path)) return null;
  if (segments.length === 2) return { consumed: segments, posParams: { slug: segments[1] } };
  if (segments.length === 3 && segments[2].path === 'account-journals') {
    return { consumed: segments, posParams: { slug: segments[1] } };
  }
  return null;
};

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/reports-catalog/reports-catalog.component').then(m => m.ReportsCatalogComponent),
    data: { permissionPath: 'reportsSecurity.actions.view.access' },
  },
  {
    matcher: businessOverviewMatcher,
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./business-overview/pages/bo-report-host/bo-report-host.component').then(m => m.BoReportHostComponent),
    // The per-report privilege is checked inside the host (it depends on the slug).
    data: { permissionPath: 'reportsSecurity.actions.view.access' },
  },
  {
    path: 'view/:slug',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/report-view/report-view.component').then(m => m.ReportViewComponent),
    // Per-report privileges are enforced in the catalog (which reports are
    // shown/openable); the shell itself only needs list-view access.
    data: { permissionPath: 'reportsSecurity.actions.view.access' },
  },
  {
    // The custom-report builder (migrated from the legacy reports-system).
    // Full-screen, no app chrome — the builder owns the whole viewport.
    path: 'builder',
    loadChildren: () =>
      import('./custom/custom-reports.routes').then(m => m.CUSTOM_REPORTS_ROUTES),
  },
];
