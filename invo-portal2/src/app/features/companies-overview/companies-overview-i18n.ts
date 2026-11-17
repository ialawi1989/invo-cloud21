import { registerBundledFeature } from '@core/i18n/language.service';

/** Companies Overview translations ship in the bundle; importing this file registers the `companies-overview` namespace. */
registerBundledFeature('companies-overview', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
