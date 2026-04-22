import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { privilegeGuard } from '@core/guards/privilege.guard';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /products                            → redirects to /products/list
// /products/list                       → product list
// /products/form/:type/new             → create a new product of :type
// /products/form/:type/:id             → edit an existing product (id ≠ 'new')
// /products/form/:type/:id?clone=true  → clone source :id into a new product
//
// :type is one of: inventory | serialized | batch | kit | service |
//                  package  | menuItem   | menuSelection | tailoring
// Keeping :type in the URL lets the form resolve field visibility
// (`fieldsOptions`) instantly from the route, before the product loads.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blocks route activation until the `products` translation namespace is
 * fetched and merged. Prevents templates from rendering raw `PRODUCTS.*`
 * keys on first paint.
 *
 * Uses a module-level cache so we only pay the HTTP cost on the first
 * navigation into the products feature per language — LanguageService
 * itself also dedups via its `loaded` map.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('products');
  return true;
};

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/products-list/products-list.component').then(m => m.ProductsListComponent),
    data: { permissionPath: 'productSecurity.actions.view' },
  },
  {
    path: 'form/:type/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent),
    // `add` is the Add/Edit privilege in this model — there is no separate
    // edit action (see privileges/definitions/productSecurity.ts).
    data: { permissionPath: 'productSecurity.actions.add.access' },
  },
];
