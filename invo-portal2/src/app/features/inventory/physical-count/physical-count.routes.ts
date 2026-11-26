import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import './physical-count-i18n';
import { isCountMode } from './models/physical-count.model';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /inventory/physical-counts                → list
// /inventory/physical-counts/view/:id       → view (record rail + paper + journal)
// /inventory/physical-counts/new/:mode      → create; :mode = by-product | by-all-products | by-inventory | by-category
// /inventory/physical-counts/edit/:id       → edit (Open / Calculated); counting, calculating and committing
// ─────────────────────────────────────────────────────────────────────────────

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('inventory/physical-count');
  return true;
};

/** An unknown start mode has nothing to show: go back to the list. */
const validMode: CanActivateFn = route =>
  isCountMode(route.paramMap.get('mode')) || inject(Router).createUrlTree(['/inventory/physical-counts']);

export const PHYSICAL_COUNT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/physical-count-list/physical-count-list.component').then(m => m.PhysicalCountListComponent),
    data: { permissionPath: 'inventoryPhysicalCountsSecurity.actions.view.access' },
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/physical-count-view/physical-count-view.component').then(m => m.PhysicalCountViewComponent),
    data: { pageWidth: 'bleed', permissionPath: 'inventoryPhysicalCountsSecurity.actions.view.access' },
  },
  {
    path: 'new/:mode',
    canActivate: [validMode, translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/physical-count-form/physical-count-form.component').then(m => m.PhysicalCountFormComponent),
    data: { permissionPath: 'inventoryPhysicalCountsSecurity.actions.add.access' },
  },
  {
    path: 'edit/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/physical-count-form/physical-count-form.component').then(m => m.PhysicalCountFormComponent),
    data: { permissionPath: 'inventoryPhysicalCountsSecurity.actions.add.access' },
  },
];
