import { registerBundledFeature } from '@core/i18n/language.service';

/** Transfer translations ship in the bundle; importing this file registers the `inventory/transfer` namespace. */
registerBundledFeature('inventory/transfer', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
