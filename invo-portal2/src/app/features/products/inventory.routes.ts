import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { privilegeGuard } from '@core/guards/privilege.guard';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /inventory/locations                         → inventory locations list
// /inventory/locations/:id                     → location form (`new` creates)
// /inventory/request                           → inventory requests list
// /inventory/request/:id                       → request form (`new` creates)
// /inventory/request/:id/view                  → request view
// /inventory/request/convert-to-purchase-order/:id
// /inventory/request/purchase-order/:id
// Components live in the products feature (they share its i18n namespace and
// services); only the URL space is `inventory`, next to the sidebar's
// Inventory group (physical-counts, transfer).
// ─────────────────────────────────────────────────────────────────────────────

/** Same guard as `products.routes.ts`: merge the `products` i18n namespace before first paint. */
const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('products');
  return true;
};

export const INVENTORY_ROUTES: Routes = [
  // ── Inventory locations ───────────────────────────────────────────────────
  {
    path: 'locations',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/inventory-locations/inventory-locations-list/inventory-locations-list.component').then(m => m.InventoryLocationsListComponent),
    data: { permissionPath: 'inventoryLocationsSecurity.actions.view.access' },
  },
  {
    path: 'locations/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/inventory-locations/inventory-locations-form/inventory-locations-form.component').then(m => m.InventoryLocationsFormComponent),
    data: { permissionPath: 'inventoryLocationsSecurity.actions.add.access' },
  },

  // ── Inventory requests (sidebar id 82 → /inventory/request) ─────
  // Specific multi-segment routes first so `:id` / `:id/view` never swallow them.
  {
    path: 'request',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/inventory-request/inventory-request-list/inventory-request-list.component').then(m => m.InventoryRequestListComponent),
    data: { permissionPath: 'productSecurity.actions.requestInventory.access' },
  },
  {
    path: 'request/convert-to-purchase-order/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/inventory-request/convert-to-purchase-order/convert-to-purchase-order.component').then(m => m.ConvertToPurchaseOrderComponent),
    // Same gate legacy used for this screen.
    data: { permissionPath: 'purchaseOrderSecurity.actions.convert.access' },
  },
  {
    path: 'request/purchase-order/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/inventory-request/purchase-order-view/purchase-order-view.component').then(m => m.PurchaseOrderViewComponent),
    data: { permissionPath: 'purchaseOrderSecurity.actions.add.access' },
  },
  {
    path: 'request/:id/view',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/inventory-request/inventory-request-view/inventory-request-view.component').then(m => m.InventoryRequestViewComponent),
    data: { permissionPath: 'productSecurity.actions.requestInventory.access' },
  },
  {
    // `new` creates; any other id edits.
    path: 'request/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/inventory-request/inventory-request-form/inventory-request-form.component').then(m => m.InventoryRequestFormComponent),
    data: { permissionPath: 'productSecurity.actions.requestInventoryAdd.access' },
  },
];
