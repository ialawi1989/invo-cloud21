import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /settings/discounts          → list
 *   /settings/discounts/new      → create
 *   /settings/discounts/:id      → edit
 *
 * Privilege gate maps to `discountSecurity.actions.*` on the
 * settings tile that surfaces this feature.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  // Discount form embeds the price-label product picker modal —
  // load its namespace too so the picker labels render text
  // instead of raw `PRICE_LABEL.PICKER.*` keys.
  await Promise.all([
    lang.loadFeature('discount'),
    lang.loadFeature('price-label'),
  ]);
  return true;
};

export const DISCOUNT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/list/discount-list.component').then(m => m.DiscountListComponent),
  },
  {
    path: ':id',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/form/discount-form.component').then(m => m.DiscountFormComponent),
  },
];
