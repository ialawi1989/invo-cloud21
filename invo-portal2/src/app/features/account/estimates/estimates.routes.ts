import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/estimate            → list
// /account/estimate/view/:id   → view
// /account/estimate/:id        → form (0 / new = create, ?cloned=yes = clone)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/estimates');
  return true;
};

export const ESTIMATES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'estimateSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/estimates-list/estimates-list.component').then(m => m.EstimatesListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'estimateSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/estimate-view/estimate-view.component').then(m => m.EstimateViewComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'estimateSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/estimate-form/estimate-form.component').then(m => m.EstimateFormComponent),
  },
];
