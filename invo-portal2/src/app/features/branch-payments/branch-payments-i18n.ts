import { registerBundledFeature } from '@core/i18n/language.service';

/** Branch payments translations ship in the bundle; importing this file registers the `branch-payments` namespace. */
registerBundledFeature('branch-payments', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
