import { registerBundledFeature } from '@core/i18n/language.service';

/** Domain settings translations ship in the bundle; importing this file registers the `domain-settings` namespace. */
registerBundledFeature('domain-settings', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
