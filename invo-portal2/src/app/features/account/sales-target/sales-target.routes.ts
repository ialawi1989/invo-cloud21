import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

// /account/sales-target-dashboard   -> the dashboard (the legacy path; `?target=<id>` opens a saved target)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/sales-target');
  return true;
};

export const SALES_TARGET_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'salesTargetSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/sales-target-dashboard/sales-target-dashboard.component').then(m => m.SalesTargetDashboardComponent),
  },
];
