import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import './price-management-i18n';

// URL pattern
//   /price-management        -> list
//   /price-management/new    -> create
//   /price-management/:id    -> edit
// (legacy used `price-management/0` for create; `0` is still accepted by the form.)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('price-management');
  return true;
};

export const PRICE_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/price-management-list/price-management-list.component').then(m => m.PriceManagementListComponent),
    data: { permissionPath: 'priceManagementSecurity.actions.view.access' },
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/price-management-form/price-management-form.component').then(m => m.PriceManagementFormComponent),
    data: { permissionPath: 'priceManagementSecurity.actions.add.access' },
  },
];
