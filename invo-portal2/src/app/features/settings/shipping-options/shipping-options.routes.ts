import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await Promise.all([lang.loadFeature('settings/shipping'), lang.loadFeature('settings')]);
  return true;
};

export const SHIPPING_OPTIONS_ROUTES: Routes = [
  {
    path: '',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/shipping-options.component').then(m => m.ShippingOptionsPageComponent),
  },
];
