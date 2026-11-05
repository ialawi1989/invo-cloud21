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
registerBundledFeature('account/customer-segments', {
  en: () => import('./customer-segments/i18n/en.json'),
  ar: () => import('./customer-segments/i18n/ar.json'),
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
registerBundledFeature('account/recurring-invoices', {
  en: () => import('./recurring-invoices/i18n/en.json'),
  ar: () => import('./recurring-invoices/i18n/ar.json'),
});
registerBundledFeature('account/credit-notes', {
  en: () => import('./credit-notes/i18n/en.json'),
  ar: () => import('./credit-notes/i18n/ar.json'),
});
registerBundledFeature('account/suppliers', {
  en: () => import('./suppliers/i18n/en.json'),
  ar: () => import('./suppliers/i18n/ar.json'),
});
registerBundledFeature('account/purchase-orders', {
  en: () => import('./purchase-orders/i18n/en.json'),
  ar: () => import('./purchase-orders/i18n/ar.json'),
});
registerBundledFeature('account/bills', {
  en: () => import('./bills/i18n/en.json'),
  ar: () => import('./bills/i18n/ar.json'),
});
registerBundledFeature('account/bills-payment', {
  en: () => import('./bills-payment/i18n/en.json'),
  ar: () => import('./bills-payment/i18n/ar.json'),
});
registerBundledFeature('account/supplier-credits', {
  en: () => import('./supplier-credits/i18n/en.json'),
  ar: () => import('./supplier-credits/i18n/ar.json'),
});
registerBundledFeature('account/bill-of-entry', {
  en: () => import('./bill-of-entry/i18n/en.json'),
  ar: () => import('./bill-of-entry/i18n/ar.json'),
});
registerBundledFeature('account/recurring-bills', {
  en: () => import('./recurring-bills/i18n/en.json'),
  ar: () => import('./recurring-bills/i18n/ar.json'),
});
registerBundledFeature('account/expenses', {
  en: () => import('./expenses/i18n/en.json'),
  ar: () => import('./expenses/i18n/ar.json'),
});
registerBundledFeature('account/recurring-expenses', {
  en: () => import('./recurring-expenses/i18n/en.json'),
  ar: () => import('./recurring-expenses/i18n/ar.json'),
});
registerBundledFeature('account/vat-payment', {
  en: () => import('./vat-payment/i18n/en.json'),
  ar: () => import('./vat-payment/i18n/ar.json'),
});
registerBundledFeature('account/budget', {
  en: () => import('./budget/i18n/en.json'),
  ar: () => import('./budget/i18n/ar.json'),
});
registerBundledFeature('account/sales-target', {
  en: () => import('./sales-target/i18n/en.json'),
  ar: () => import('./sales-target/i18n/ar.json'),
});
