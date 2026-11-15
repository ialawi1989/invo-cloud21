import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import './cheque-builder-i18n';

// /settings/cheque-builder       -> list
// /settings/cheque-builder/new   -> create
// /settings/cheque-builder/:id   -> edit (declared last so it does not swallow `new`)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('cheque-builder');
  return true;
};

export const CHEQUE_BUILDER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/cheque-list/cheque-list.component').then(m => m.ChequeListComponent),
    data: { permissionPath: 'chequeBuilderSecurity.actions.view.access' },
  },
  {
    path: 'new',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/cheque-form/cheque-form.component').then(m => m.ChequeFormComponent),
    data: { permissionPath: 'chequeBuilderSecurity.actions.add.access' },
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/cheque-form/cheque-form.component').then(m => m.ChequeFormComponent),
    data: { permissionPath: 'chequeBuilderSecurity.actions.add.access' },
  },
];
