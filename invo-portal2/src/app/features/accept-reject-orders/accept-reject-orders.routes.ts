import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';

import './accept-reject-orders-i18n';

// /accept-reject-order-cloud → online orders by status / branch with Accept / Reject

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('accept-reject-orders');
  return true;
};

export const ACCEPT_REJECT_ORDERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/accept-reject-orders-list/accept-reject-orders-list.component').then(m => m.AcceptRejectOrdersListComponent),
    data: { permissionPath: 'acceptRejectOrderCloudSecurity.actions.view.access' },
  },
];
