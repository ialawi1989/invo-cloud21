import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * Product Collections — reusable Manual/Auto product groupings surfaced on the
 * storefront. Top-level route (sidebar menu id 313), co-located with the
 * products feature but living at `/products-collections/*` in the URL space.
 *
 *   /products-collections          → list
 *   /products-collections/new      → create
 *   /products-collections/:id      → edit
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('products');
  return true;
};

export const PRODUCTS_COLLECTIONS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'productsCollectionsSecurity.actions.view' },
    loadComponent: () =>
      import('./products-collections-list.component').then(m => m.ProductsCollectionsListComponent),
  },
  {
    // `new` creates, any other :id edits. `add` is the Add/Edit privilege in
    // this model (see productsCollectionsSecurity.ts).
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'productsCollectionsSecurity.actions.add.access' },
    loadComponent: () =>
      import('./products-collections-form.component').then(m => m.ProductsCollectionsFormComponent),
  },
];
