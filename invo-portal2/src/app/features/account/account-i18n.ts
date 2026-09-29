import { registerBundledFeature } from '@core/i18n/language.service';

/**
 * Translations of the sales section ship inside the bundle (lazy JSON chunks) so they never depend
 * on the dev server's asset list or on cached `i18n/features/...` responses. Importing this file
 * (a side effect) registers the namespaces `LanguageService.loadFeature()` asks for.
 */
registerBundledFeature('account/customers', {
  en: () => import('./customers/i18n/en.json'),
  ar: () => import('./customers/i18n/ar.json'),
});
registerBundledFeature('account/invoices', {
  en: () => import('./invoices/i18n/en.json'),
  ar: () => import('./invoices/i18n/ar.json'),
});
registerBundledFeature('account/payments', {
  en: () => import('./payments/i18n/en.json'),
  ar: () => import('./payments/i18n/ar.json'),
});
registerBundledFeature('account/components/doc-lines-table', {
  en: () => import('./components/doc-lines-table/i18n/en.json'),
  ar: () => import('./components/doc-lines-table/i18n/ar.json'),
});
registerBundledFeature('account/estimates', {
  en: () => import('./estimates/i18n/en.json'),
  ar: () => import('./estimates/i18n/ar.json'),
});
