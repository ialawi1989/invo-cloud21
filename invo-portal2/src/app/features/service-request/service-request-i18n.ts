import { registerBundledFeature } from '@core/i18n/language.service';

/** Service request translations ship in the bundle; importing this file registers the `service-request` namespace. */
registerBundledFeature('service-request', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
