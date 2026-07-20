import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
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

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/reports-catalog/reports-catalog.component').then(m => m.ReportsCatalogComponent),
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
