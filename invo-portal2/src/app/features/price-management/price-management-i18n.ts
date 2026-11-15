import { registerBundledFeature } from '@core/i18n/language.service';

/** Price management translations ship in the bundle; importing this file registers the `price-management` namespace. */
registerBundledFeature('price-management', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
