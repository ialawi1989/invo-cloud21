import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// ── URL pattern (legacy-compatible) ──────────────────────────────────────────
// /account/customers            → customers list
// /account/customers/new        → new customer          (form — next step)
// /account/customers/:id        → edit customer         (form — next step)
// /account/customers/view/:id   → customer dashboard    (later step)
// `view` is declared before `:id` so it isn't swallowed as an id.
// ─────────────────────────────────────────────────────────────────────────────

/** Loads the `customers` translation namespace before first paint. */
const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/customers');
  return true;
};

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'customerSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/customers-list/customers-list.component').then(m => m.CustomersListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'customerSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/customer-dashboard/customer-dashboard.component').then(m => m.CustomerDashboardComponent),
  },
  {
    // New + edit share one page; `0` means "new" (legacy URL).
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'customerSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/customer-form/customer-form.component').then(m => m.CustomerFormComponent),
  },
];
