import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { planFeatureGuard } from '@core/guards/feature.guard';
import {
  CAMPAIGNS_FEATURE_KEYS, PROMOTIONS_COUPONS, PROMOTIONS_CUSTOMER_TIERS, PROMOTIONS_POINTS,
  PROMOTIONS_STAMP_CARDS, PROMOTIONS_VOUCHERS,
} from './promotions-feature-flags';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /promotions/promotions-vouchers            → gift vouchers (settings summary + list)
// /promotions/promotions-vouchers/new        → give vouchers
// /promotions/promotions-vouchers/settings   → gift voucher settings
// /promotions/promotions-vouchers/history     → settings change log
// /promotions/promotions-vouchers/:id         → voucher details (actions, history)
// /promotions/promotions-vouchers/:id/edit    → edit a voucher
// /promotions/customer-tiers               → tiers (view + edit in place), /history → change log
// /promotions/promotional-points             → points (simple/advanced), /new, /settings, /history, /:id
// /promotions/campaigns                      → campaigns, /new/:type, /:id, /:id/edit, /:id/clone
// Static segments come before `:id` so they aren't swallowed as an id.
// ─────────────────────────────────────────────────────────────────────────────

/** Loads the `promotions` translation namespace before first paint. */
const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('promotions');
  return true;
};

const VOUCHERS = 'PromotionalVoucherPrivileges';
const TIERS = 'customerTiersPrivileges';
const POINTS = 'PromotionalPointsPrivileges';
const COUPONS = 'couponsPrivileges';
const CAMPAIGNS = 'CampaignsPrivileges';

export const PROMOTIONS_ROUTES: Routes = [
  { path: '', redirectTo: 'promotions-vouchers', pathMatch: 'full' },
  {
    path: 'promotions-vouchers',
    // Plan-gated: the backend refuses these endpoints ("This feature is not available for
    // your account") when the company lacks `promotions.vouchers`, so don't open the page.
    canActivate: [translationsLoaded, planFeatureGuard, privilegeGuard],
    data: { permissionPath: `${VOUCHERS}.access`, planFeature: PROMOTIONS_VOUCHERS },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/vouchers/vouchers-list/vouchers-list.component').then(m => m.VouchersListComponent),
      },
      {
        path: 'new',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${VOUCHERS}.actions.AddVoucher.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/vouchers/voucher-form/voucher-form.component').then(m => m.VoucherFormComponent),
      },
      {
        path: 'settings',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${VOUCHERS}.actions.EditRate.access` },
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
        data: { pageWidth: 'narrow', permissionPath: `${VOUCHERS}.actions.EditRate.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/vouchers/voucher-form/voucher-form.component').then(m => m.VoucherFormComponent),
      },
    ],
  },
  {
    path: 'customer-tiers',
    canActivate: [translationsLoaded, planFeatureGuard, privilegeGuard],
    data: { permissionPath: `${TIERS}.access`, planFeature: PROMOTIONS_CUSTOMER_TIERS },
    children: [
      { data: { pageWidth: 'form' },
        path: '',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/tiers/tiers-page/tiers-page.component').then(m => m.TiersPageComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./pages/tiers/tiers-history/tiers-history.component').then(m => m.TiersHistoryComponent),
      },
    ],
  },
  {
    path: 'promotional-points',
    canActivate: [translationsLoaded, planFeatureGuard, privilegeGuard],
    data: { permissionPath: `${POINTS}.access`, planFeature: PROMOTIONS_POINTS },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/points/points-list/points-list.component').then(m => m.PointsListComponent),
      },
      {
        path: 'new',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${POINTS}.actions.AddPoints.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/points/points-form/points-form.component').then(m => m.PointsFormComponent),
      },
      {
        path: 'settings',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${POINTS}.actions.EditRate.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/points/points-settings/points-settings.component').then(m => m.PointsSettingsComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./pages/points/points-history/points-history.component').then(m => m.PointsHistoryComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/points/points-details/points-details.component').then(m => m.PointsDetailsComponent),
      },
    ],
  },
  {
    path: 'coupons',
    canActivate: [translationsLoaded, planFeatureGuard, privilegeGuard],
    data: { permissionPath: `${COUPONS}.access`, planFeature: [PROMOTIONS_COUPONS, PROMOTIONS_STAMP_CARDS] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/coupons/coupons-list/coupons-list.component').then(m => m.CouponsListComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./pages/coupons/coupons-history/coupons-history.component').then(m => m.CouponsHistoryComponent),
      },
      {
        path: 'new/:type',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${COUPONS}.actions.AddCouponSets.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/coupons/coupon-set-form/coupon-set-form.component').then(m => m.CouponSetFormComponent),
      },
      {
        path: 'coupon/:couponId',
        loadComponent: () =>
          import('./pages/coupons/coupon-details/coupon-details.component').then(m => m.CouponDetailsComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/coupons/coupon-set-details/coupon-set-details.component').then(m => m.CouponSetDetailsComponent),
      },
      {
        path: ':id/edit',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${COUPONS}.actions.EditCouponSets.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/coupons/coupon-set-form/coupon-set-form.component').then(m => m.CouponSetFormComponent),
      },
    ],
  },
  {
    path: 'campaigns',
    canActivate: [translationsLoaded, planFeatureGuard, privilegeGuard],
    data: { permissionPath: `${CAMPAIGNS}.access`, planFeature: [...CAMPAIGNS_FEATURE_KEYS] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/campaigns/campaigns-list/campaigns-list.component').then(m => m.CampaignsListComponent),
      },
      {
        path: 'new/:type',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${CAMPAIGNS}.actions.AddCampaigns.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/campaigns/campaign-form/campaign-form.component').then(m => m.CampaignFormComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/campaigns/campaign-details/campaign-details.component').then(m => m.CampaignDetailsComponent),
      },
      {
        path: ':id/edit',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${CAMPAIGNS}.actions.EditRate.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/campaigns/campaign-form/campaign-form.component').then(m => m.CampaignFormComponent),
      },
      {
        path: ':id/clone',
        canDeactivate: [unsavedChangesGuard],
        data: { pageWidth: 'narrow', permissionPath: `${CAMPAIGNS}.actions.SpendCampaigns.access` },
        canActivate: [privilegeGuard],
        loadComponent: () =>
          import('./pages/campaigns/campaign-form/campaign-form.component').then(m => m.CampaignFormComponent),
      },
    ],
  },
];
