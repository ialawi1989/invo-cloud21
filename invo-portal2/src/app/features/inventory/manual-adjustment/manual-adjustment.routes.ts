import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import './manual-adjustment-i18n';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /manual-adjustment            → list
// /manual-adjustment/view/:id   → view (record rail + paper + journal)
// /manual-adjustment/new        → create
// /manual-adjustment/:id        → edit
// ─────────────────────────────────────────────────────────────────────────────

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('inventory/manual-adjustment');
  return true;
};

export const MANUAL_ADJUSTMENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/manual-adjustment-list/manual-adjustment-list.component').then(m => m.ManualAdjustmentListComponent),
    data: { permissionPath: 'manualAdjustmentSecurity.actions.view.access' },
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/manual-adjustment-view/manual-adjustment-view.component').then(m => m.ManualAdjustmentViewComponent),
    data: { pageWidth: 'bleed', permissionPath: 'manualAdjustmentSecurity.actions.view.access' },
  },
  {
    path: 'new',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/manual-adjustment-form/manual-adjustment-form.component').then(m => m.ManualAdjustmentFormComponent),
    data: { permissionPath: 'manualAdjustmentSecurity.actions.add.access' },
  },
  {
    // Declared last: it would otherwise swallow `view/:id`.
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/manual-adjustment-form/manual-adjustment-form.component').then(m => m.ManualAdjustmentFormComponent),
    data: { permissionPath: 'manualAdjustmentSecurity.actions.add.access' },
  },
];
