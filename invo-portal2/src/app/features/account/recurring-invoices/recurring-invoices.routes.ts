import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/recurring-invoice            → list
// /account/recurring-invoice/view/:id   → view
// /account/recurring-invoice/:id        → form (`new` / `0` = create; `?fromInvoice=yes` pre-fills from the
//                                          invoice handed over in session storage by "Make Recurring")

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/recurring-invoices');
  return true;
};

export const RECURRING_INVOICES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringInvoiceSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-invoices-list/recurring-invoices-list.component').then(m => m.RecurringInvoicesListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringInvoiceSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-invoice-view/recurring-invoice-view.component').then(m => m.RecurringInvoiceViewComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'recurringInvoiceSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/recurring-invoice-form/recurring-invoice-form.component').then(m => m.RecurringInvoiceFormComponent),
  },
];
