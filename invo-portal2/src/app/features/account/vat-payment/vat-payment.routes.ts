import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/vat-payment            -> list
// /account/vat-payment/view/:id   -> view
// /account/vat-payment/:id        -> form (0 / new = create)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/vat-payment');
  return true;
};

export const VAT_PAYMENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'vatPayment.actions.view.access' },
    loadComponent: () => import('./pages/vat-payment-list/vat-payment-list.component').then(m => m.VatPaymentListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'vatPayment.actions.view.access' },
    loadComponent: () => import('./pages/vat-payment-view/vat-payment-view.component').then(m => m.VatPaymentViewComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'vatPayment.actions.add.access' },
    loadComponent: () => import('./pages/vat-payment-form/vat-payment-form.component').then(m => m.VatPaymentFormComponent),
  },
];
