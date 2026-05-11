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
 *                                                     an online provider
 *                                                     (only AFS in MVP)
 *
 * Privilege gate maps to `paymentMethodSecurity.actions.*` on the
 * settings tile that surfaces this feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('payment-methods');
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
    path: ':id',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/form/payment-method-form.component').then(m => m.PaymentMethodFormComponent),
  },
];
