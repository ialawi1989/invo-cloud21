import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import './service-request-i18n';

// ── URL pattern (mount at `paging`: the sidebar already links /paging) ───────
// /paging          → list
// /paging/new      → create
// /paging/:id      → edit
// ─────────────────────────────────────────────────────────────────────────────

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('service-request');
  return true;
};

export const SERVICE_REQUEST_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/service-request-list/service-request-list.component').then(m => m.ServiceRequestListComponent),
    data: { permissionPath: 'pagingSecurity.actions.view.access' },
  },
  {
    path: 'new',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/service-request-form/service-request-form.component').then(m => m.ServiceRequestFormComponent),
    data: { permissionPath: 'pagingSecurity.actions.add.access' },
  },
  {
    // Declared last: it would otherwise swallow `new`.
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/service-request-form/service-request-form.component').then(m => m.ServiceRequestFormComponent),
    data: { permissionPath: 'pagingSecurity.actions.add.access' },
  },
];
