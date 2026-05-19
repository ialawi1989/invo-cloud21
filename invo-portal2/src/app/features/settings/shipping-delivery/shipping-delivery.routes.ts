import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/** Pre-load every namespace the hub or its embedded children touch so
 *  the picker labels and the embedded view both render with localised
 *  text on first paint. The hub's own keys live under
 *  `SHIPPING_DELIVERY.*` inside the `shipping` bundle (no separate
 *  feature folder — see the component for why). */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await Promise.all([
    lang.loadFeature('shipping'),
    lang.loadFeature('covered-address'),
    lang.loadFeature('covered-zone'),
    lang.loadFeature('settings'),
  ]);
  return true;
};

export const SHIPPING_DELIVERY_ROUTES: Routes = [
  {
    path: '',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/shipping-delivery.component').then(m => m.ShippingDeliveryComponent),
  },
];
