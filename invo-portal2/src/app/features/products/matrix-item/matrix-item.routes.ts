import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /matrix-item          → list
 *   /matrix-item/new      → create
 *   /matrix-item/:id      → edit
 *
 * The sidebar already links `/matrix-item` (menu id 112) with privilege
 * `matrixItemSecurity.actions.view`.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('products/matrix-item');
  return true;
};

export const MATRIX_ITEM_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'matrixItemSecurity.actions.view' },
    loadComponent: () =>
      import('./pages/matrix-list/matrix-list.component').then(m => m.MatrixListComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    // `add` is the Add/Edit privilege in this model (no separate edit action).
    data: { permissionPath: 'matrixItemSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/matrix-form/matrix-form.component').then(m => m.MatrixFormComponent),
  },
];
