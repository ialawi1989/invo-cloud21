import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { BillsService } from './services/bills.service';
import { BillActions } from './services/bill-actions';
import { docEditableGuard } from '../guards/doc-editable.guard';

// /account/bills                                   -> list
// /account/bills/view/:id                          -> view
// /account/bills/convert-from-purchase/:purchaseId -> new bill made from a purchase order (?usePartialQty=true)
// /account/bills/:id                               -> form (0 / new = create, ?cloned=yes = clone)
// /account/bills/pay/:billId                      -> pay one bill (bill-payment form)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/bills');
  return true;
};

const form = () => import('./pages/bill-form/bill-form.component').then(m => m.BillFormComponent);

/** `/account/bills/:id`: a bill with a bill of entry, closed, or in a locked period opens read-only. */
const billEditableGuard = docEditableGuard(() => {
  const svc = inject(BillsService);
  const actions = inject(BillActions);
  return {
    load: (id: string) => svc.getBill(id),
    block: async (b: any) => { await actions.refresh(b.branchId || null); return actions.editStateBlock(b); },
  };
}, '/account/bills/view');

export const BILLS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'billingSecurity.actions.view.access' },
    loadComponent: () => import('./pages/bills-list/bills-list.component').then(m => m.BillsListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'billingSecurity.actions.view.access' },
    loadComponent: () => import('./pages/bill-view/bill-view.component').then(m => m.BillViewComponent),
  },
  {
    // The bill's own "Pay" page: the bill-payment form with this bill and its balance filled in.
    path: 'pay/:billId',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'billingPaymentsSecurity.actions.add.access' },
    loadComponent: () => import('../bills-payment/pages/bill-payment-form/bill-payment-form.component').then(m => m.BillPaymentFormComponent),
  },
  {
    path: 'convert-from-purchase/:purchaseId',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'purchaseOrderSecurity.actions.convert.access' },
    loadComponent: form,
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard, billEditableGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'billingSecurity.actions.add.access' },
    loadComponent: form,
  },
];
