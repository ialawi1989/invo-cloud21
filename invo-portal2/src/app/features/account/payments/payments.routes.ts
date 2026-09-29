import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/payments            → list
// /account/payments/view/:id   → payment view   (next step)
// /account/payments/new | :id   → payment form   (next step)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/payments');
  return true;
};

export const PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'invoicePaymentsSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/payments-list/payments-list.component').then(m => m.PaymentsListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'invoicePaymentsSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/payment-view/payment-view.component').then(m => m.PaymentViewComponent),
  },
  {
    // New (`0`) and edit share one page — legacy URLs.
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'invoicePaymentsSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/payment-form/payment-form.component').then(m => m.PaymentFormComponent),
  },
];
