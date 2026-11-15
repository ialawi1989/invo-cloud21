import { registerBundledFeature } from '@core/i18n/language.service';

/** Accept / reject orders translations ship in the bundle; importing this file registers the `accept-reject-orders` namespace. */
registerBundledFeature('accept-reject-orders', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
