import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { BillsPaymentService } from './services/bills-payment.service';
import { BillPaymentActions } from './services/bill-payment-actions';
import { docEditableGuard } from '../guards/doc-editable.guard';

// /account/bills-payment            -> list
// /account/bills-payment/view/:id   -> view
// /account/bills-payment/:id        -> form (0 / new = create)
// (the bill's own "Pay" page, /account/bills/pay/:billId, serves the same form - see bills.routes.ts)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/bills-payment');
  return true;
};

/** `/account/bills-payment/:id`: a reconciled bill payment opens read-only. */
const billPaymentEditableGuard = docEditableGuard(() => {
  const svc = inject(BillsPaymentService);
  const actions = inject(BillPaymentActions);
  return {
    load: (id: string) => svc.getBillingPayment(id),
    block: (p: any) => actions.editStateBlock(p),
  };
}, '/account/bills-payment/view');

export const BILLS_PAYMENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'billingPaymentsSecurity.actions.view.access' },
    loadComponent: () => import('./pages/bills-payment-list/bills-payment-list.component').then(m => m.BillsPaymentListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'billingPaymentsSecurity.actions.view.access' },
    loadComponent: () => import('./pages/bill-payment-view/bill-payment-view.component').then(m => m.BillPaymentViewComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard, billPaymentEditableGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'billingPaymentsSecurity.actions.add.access' },
    loadComponent: () => import('./pages/bill-payment-form/bill-payment-form.component').then(m => m.BillPaymentFormComponent),
  },
];
