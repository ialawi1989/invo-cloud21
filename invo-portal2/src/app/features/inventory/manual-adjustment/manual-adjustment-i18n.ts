import { registerBundledFeature } from '@core/i18n/language.service';

/** Manual adjustment translations ship in the bundle; importing this file registers the `inventory/manual-adjustment` namespace. */
registerBundledFeature('inventory/manual-adjustment', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
