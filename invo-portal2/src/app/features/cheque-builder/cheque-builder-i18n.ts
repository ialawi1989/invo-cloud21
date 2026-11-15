import { registerBundledFeature } from '@core/i18n/language.service';

/** Cheque builder translations ship in the bundle; importing this file registers the `cheque-builder` namespace. */
registerBundledFeature('cheque-builder', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
