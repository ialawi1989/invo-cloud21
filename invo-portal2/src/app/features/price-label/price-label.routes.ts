import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /price-label             → list
 *   /price-label/new         → create
 *   /price-label/:id         → edit
 *
 * Privilege gate maps to `priceLabelSecurity.actions.*` on the
 * settings tile that surfaces this feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('price-label');
  return true;
};

export const PRICE_LABEL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/list/price-label-list.component').then(m => m.PriceLabelListComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/form/price-label-form.component').then(m => m.PriceLabelFormComponent),
  },
];
