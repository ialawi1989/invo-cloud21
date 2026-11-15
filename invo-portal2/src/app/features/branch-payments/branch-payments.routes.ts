import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

import './branch-payments-i18n';

// /branch-payments → list of branches with a "Get Payments" action

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('branch-payments');
  return true;
};

export const BRANCH_PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/branch-payments-list/branch-payments-list.component').then(m => m.BranchPaymentsListComponent),
    data: { permissionPath: 'branchPaymentsSecurity.actions.view.access' },
  },
];
