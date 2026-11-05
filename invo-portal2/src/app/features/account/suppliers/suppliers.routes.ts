import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/suppliers        → suppliers list
// /account/suppliers/view/:id → supplier dashboard
// /account/suppliers/:id    → form (0 / new = create)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/suppliers');
  return true;
};

export const SUPPLIERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'supplierSecurity.actions.view.access' },
    loadComponent: () => import('./pages/suppliers-list/suppliers-list.component').then(m => m.SuppliersListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'supplierSecurity.actions.view.access' },
    loadComponent: () => import('./pages/supplier-dashboard/supplier-dashboard.component').then(m => m.SupplierDashboardComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'supplierSecurity.actions.add.access' },
    loadComponent: () => import('./pages/supplier-form/supplier-form.component').then(m => m.SupplierFormComponent),
  },
];
