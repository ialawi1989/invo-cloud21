import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

import './companies-overview-i18n';

// /companies-overview → sales + payments of every company in the group (legacy `companies-overview/dashboard` + `reports`)

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  // The shared report filter bar reads the `reports` namespace.
  await Promise.all([lang.loadFeature('companies-overview'), lang.loadFeature('reports')]);
  return true;
};

export const COMPANIES_OVERVIEW_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./layout/companies-overview-layout.component').then(m => m.CompaniesOverviewLayoutComponent),
    // The whole area is gated by one privilege: not everyone may see group-wide figures.
    data: { permissionPath: 'companiesOverviewSecurity.access' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        data: { mode: 'dashboard' },
        loadComponent: () => import('./pages/companies-overview/companies-overview.component').then(m => m.CompaniesOverviewComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/reports-list/companies-reports-list.component').then(m => m.CompaniesReportsListComponent),
      },
      {
        path: 'reports/companies-sales',
        data: { mode: 'sales' },
        loadComponent: () => import('./pages/companies-overview/companies-overview.component').then(m => m.CompaniesOverviewComponent),
      },
      {
        path: 'reports/companies-payments',
        data: { mode: 'payments' },
        loadComponent: () => import('./pages/companies-overview/companies-overview.component').then(m => m.CompaniesOverviewComponent),
      },
    ],
  },
];
