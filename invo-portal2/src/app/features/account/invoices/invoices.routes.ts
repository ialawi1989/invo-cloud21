import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/invoices             → list
// /account/invoices/new | :id    → form            (next step)
// /account/invoices/view/:id    → invoice view    (later step)
// /account/invoices/payment/:id → pay invoice     (later step)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/invoices');
  return true;
};

export const INVOICES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'invoiceSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/invoices-list/invoices-list.component').then(m => m.InvoicesListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'invoiceSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/invoice-view/invoice-view.component').then(m => m.InvoiceViewComponent),
  },
  {
    path: 'payment/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'invoicePaymentsSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/invoice-payment/invoice-payment.component').then(m => m.InvoicePaymentComponent),
  },
  {
    // New (`0`), edit and clone (`?cloned=yes`) share one page — legacy URLs.
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'invoiceSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/invoice-form/invoice-form.component').then(m => m.InvoiceFormComponent),
  },
];
