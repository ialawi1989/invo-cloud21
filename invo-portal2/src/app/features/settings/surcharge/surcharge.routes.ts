import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /settings/surcharge          → list
 *   /settings/surcharge/new      → create
 *   /settings/surcharge/:id      → edit
 *
 * Privilege gate maps to `surchargeSecurity.actions.*` on the
 * settings tile that surfaces this feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('surcharge');
  return true;
};

export const SURCHARGE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/list/surcharge-list.component').then(m => m.SurchargeListComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/form/surcharge-form.component').then(m => m.SurchargeFormComponent),
  },
];
