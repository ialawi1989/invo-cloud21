import { registerBundledFeature } from '@core/i18n/language.service';

/** E-invoice (public payment + signature pages) translations ship in the bundle; importing this file registers the `e-invoice` namespace. */
registerBundledFeature('e-invoice', {
  en: () => import('./i18n/en.json'),
  ar: () => import('./i18n/ar.json'),
});
