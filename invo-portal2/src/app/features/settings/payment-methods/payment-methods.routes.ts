import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /settings/payment-methods                       → list
 *   /settings/payment-methods/new[?type=Cash|Card]  → create
 *   /settings/payment-methods/:id                   → edit
 *   /settings/payment-methods/connect/:slug         → connect form for
 *                                                     a brand-new
 *                                                     provider record
 *   /settings/payment-methods/connect/:slug/:id     → edit an existing
 *                                                     saved record for
 *                                                     this provider —
 *                                                     skips the search
 *                                                     round-trip
 *
 * Privilege gate maps to `paymentMethodSecurity.actions.*` on the
 * settings tile that surfaces this feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  // The "+ Create new account" modal launched from the GL-account
  // picker reuses `<app-account-form-fields>`, which addresses the
  // CHART_OF_ACCOUNTS namespace. Load it alongside payment-methods
  // so the modal labels render text instead of raw keys.
  await Promise.all([
    lang.loadFeature('payment-methods'),
    lang.loadFeature('chart-of-accounts'),
  ]);
  return true;
};

export const PAYMENT_METHODS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/list/payment-methods-list.component').then(m => m.PaymentMethodsListComponent),
  },
  {
    path: 'connect/:slug',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/connect/payment-method-connect.component').then(m => m.PaymentMethodConnectComponent),
  },
  {
    path: 'connect/:slug/:id',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/connect/payment-method-connect.component').then(m => m.PaymentMethodConnectComponent),
  },
  {
    path: ':id',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/form/payment-method-form.component').then(m => m.PaymentMethodFormComponent),
  },
];
