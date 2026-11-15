import { registerBundledFeature } from '@core/i18n/language.service';

/** Questionnaire translations ship in the bundle; importing this file registers the `questionnaire` namespace. */
registerBundledFeature('questionnaire', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
