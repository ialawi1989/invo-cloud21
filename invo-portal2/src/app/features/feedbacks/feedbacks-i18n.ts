import { registerBundledFeature } from '@core/i18n/language.service';

/** Feedbacks translations ship in the bundle; importing this file registers the `feedbacks` namespace. */
registerBundledFeature('feedbacks', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
