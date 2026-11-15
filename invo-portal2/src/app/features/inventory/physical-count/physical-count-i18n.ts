import { registerBundledFeature } from '@core/i18n/language.service';

/** Physical count translations ship in the bundle; importing this file registers the `inventory/physical-count` namespace. */
registerBundledFeature('inventory/physical-count', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
