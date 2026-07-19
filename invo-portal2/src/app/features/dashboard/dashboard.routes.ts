import { CanActivateFn, Routes } from '@angular/router';
import { inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('dashboard');
  return true;
};

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/dashboard.component').then(m => m.DashboardComponent),
  },
];
