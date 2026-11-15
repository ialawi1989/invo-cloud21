import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';

import './e-invoice-i18n';

// Public customer-facing pages: NO authGuard, outside the main layout. Paths are fixed by the backend, which builds
// the links (`CLOUD_BASE_URL/einvoice/<token>` for payment + gateway redirects, `CLOUD_BASE_URL/invoiceSign/<token>`
// for signing) and the short URLs already sent to customers - so they are NOT kebab-cased.

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('e-invoice');
  return true;
};

export const E_INVOICE_PUBLIC_ROUTES: Routes = [
  {
    path: 'einvoice/:token',
    canActivate: [translationsLoaded],
    loadComponent: () => import('./pages/e-invoice-pay/e-invoice-pay.component').then(m => m.EInvoicePayComponent),
  },
  {
    path: 'invoiceSign/:token',
    canActivate: [translationsLoaded],
    loadComponent: () => import('./pages/e-invoice-signature/e-invoice-signature.component').then(m => m.EInvoiceSignatureComponent),
  },
];
