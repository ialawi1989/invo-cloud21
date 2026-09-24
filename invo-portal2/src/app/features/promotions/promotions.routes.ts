import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { privilegeGuard } from '@core/guards/privilege.guard';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /promotions/promotions-vouchers            → gift vouchers (settings summary + list)
// /promotions/promotions-vouchers/new        → give vouchers
// /promotions/promotions-vouchers/settings   → gift voucher settings
// /promotions/promotions-vouchers/history     → settings change log
// /promotions/promotions-vouchers/:id         → voucher details (actions, history)
// /promotions/promotions-vouchers/:id/edit    → edit a voucher
// Static segments come before `:id` so they aren't swallowed as an id.
// ─────────────────────────────────────────────────────────────────────────────

/** Loads the `promotions` translation namespace before first paint. */
const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('promotions');
  return true;
};

const VOUCHERS = 'PromotionalVoucherPrivileges';

export const PROMOTIONS_ROUTES: Routes = [
  { path: '', redirectTo: 'promotions-vouchers', pathMatch: 'full' },
  {
    path: 'promotions-vouchers',
    // Not plan-gated on purpose for now: this company's plan lacks the
    // `PROMOTIONS.VOUCHERS` feature and the voucher endpoints don't check it.
    // To enforce it again add `featureGuard` + `feature: 'PROMOTIONS.VOUCHERS'` here.
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: `${VOUCHERS}.access` },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/vouchers/vouchers-list/vouchers-list.component').then(m => m.VouchersListComponent),
      },
      {
        path: 'new',
        canDeactivate: [unsavedChangesGuard],
        data: { permissionPath: `${VOUCHERS}.actions.AddVoucher.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/vouchers/voucher-form/voucher-form.component').then(m => m.VoucherFormComponent),
      },
      {
        path: 'settings',
        canDeactivate: [unsavedChangesGuard],
        data: { permissionPath: `${VOUCHERS}.actions.EditRate.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/vouchers/voucher-settings/voucher-settings.component').then(m => m.VoucherSettingsComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./pages/vouchers/vouchers-history/vouchers-history.component').then(m => m.VouchersHistoryComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/vouchers/voucher-details/voucher-details.component').then(m => m.VoucherDetailsComponent),
      },
      {
        path: ':id/edit',
        canDeactivate: [unsavedChangesGuard],
        data: { permissionPath: `${VOUCHERS}.actions.EditRate.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/vouchers/voucher-form/voucher-form.component').then(m => m.VoucherFormComponent),
      },
    ],
  },
];
