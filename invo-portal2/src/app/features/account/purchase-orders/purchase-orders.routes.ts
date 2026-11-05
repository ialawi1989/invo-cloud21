import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/purchase-order              -> list
// /account/purchase-order/view/:id     -> view
// /account/purchase-order/auto-po/new  -> auto purchase order (products below their re-order point)
// /account/purchase-order/:id          -> form (0 / new = create)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/purchase-orders');
  return true;
};

export const PURCHASE_ORDERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'purchaseOrderSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/purchase-orders-list/purchase-orders-list.component').then(m => m.PurchaseOrdersListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'purchaseOrderSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/purchase-order-view/purchase-order-view.component').then(m => m.PurchaseOrderViewComponent),
  },
  {
    path: 'auto-po/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'purchaseOrderSecurity.actions.auto.access' },
    loadComponent: () =>
      import('./pages/auto-purchase-order-form/auto-purchase-order-form.component').then(m => m.AutoPurchaseOrderFormComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'purchaseOrderSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/purchase-order-form/purchase-order-form.component').then(m => m.PurchaseOrderFormComponent),
  },
];
