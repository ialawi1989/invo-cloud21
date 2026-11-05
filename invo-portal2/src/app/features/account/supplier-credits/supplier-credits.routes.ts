import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/supplier-credit                          -> list
// /account/supplier-credit/view/:id                 -> view
// /account/supplier-credit/refund/:supplierCreditId -> refund the unused balance
// /account/supplier-credit/:id                      -> form (0 / new = create)
// /account/supplier-credit/:id/forBill/:billingId   -> form for one bill ("Create Supplier Credit" on a bill)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/supplier-credits');
  return true;
};

const form = () => import('./pages/supplier-credit-form/supplier-credit-form.component').then(m => m.SupplierCreditFormComponent);

export const SUPPLIER_CREDITS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'supplierCredit.actions.view.access' },
    loadComponent: () => import('./pages/supplier-credits-list/supplier-credits-list.component').then(m => m.SupplierCreditsListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'supplierCredit.actions.view.access' },
    loadComponent: () => import('./pages/supplier-credit-view/supplier-credit-view.component').then(m => m.SupplierCreditViewComponent),
  },
  {
    path: 'refund/:supplierCreditId',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'supplierCredit.actions.refund.access' },
    loadComponent: () => import('./pages/supplier-credit-refund-form/supplier-credit-refund-form.component').then(m => m.SupplierCreditRefundFormComponent),
  },
  {
    path: ':id/forBill/:billingId',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'supplierCredit.actions.add.access' },
    loadComponent: form,
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'supplierCredit.actions.add.access' },
    loadComponent: form,
  },
];
