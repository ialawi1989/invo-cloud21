import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// ── URL pattern (legacy-compatible) ──────────────────────────────────────────
// /account/customer-segments        → segments list
// /account/customer-segments/new    → new segment   (legacy used `0`, still accepted)
// /account/customer-segments/:id    → edit segment
// ─────────────────────────────────────────────────────────────────────────────

/** Loads the segments translation namespace (+ shared customers one) before first paint. */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await Promise.all([lang.loadFeature('account/customer-segments'), lang.loadFeature('account/customers')]);
  return true;
};

export const CUSTOMER_SEGMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'customerSegmentsSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/customer-segments-list/customer-segments-list.component').then(m => m.CustomerSegmentsListComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'customerSegmentsSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/customer-segment-form/customer-segment-form.component').then(m => m.CustomerSegmentFormComponent),
  },
];
