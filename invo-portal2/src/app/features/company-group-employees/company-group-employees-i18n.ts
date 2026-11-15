import { registerBundledFeature } from '@core/i18n/language.service';

/** Company-group employees translations ship in the bundle; importing this file registers the `company-group-employees` namespace. */
registerBundledFeature('company-group-employees', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
