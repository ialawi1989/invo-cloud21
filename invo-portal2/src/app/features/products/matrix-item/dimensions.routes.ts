import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * Reusable dimensions catalog (Size / Color / Material definitions consumed by
 * the matrix builder's pick-from-catalog flow).
 *
 *   /dimensions          → list
 *   /dimensions/new      → create
 *   /dimensions/:id      → edit
 *
 * Shares the `products/matrix-item` i18n namespace + service with the matrix
 * feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('products/matrix-item');
  return true;
};

export const DIMENSIONS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'dimensionSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/dimension-list/dimension-list.component').then(m => m.DimensionListComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'dimensionSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/dimension-form/dimension-form.component').then(m => m.DimensionFormComponent),
  },
];
