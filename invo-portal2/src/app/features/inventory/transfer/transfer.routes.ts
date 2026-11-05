import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

import './transfer-i18n';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /inventory/transfer              → list
// /inventory/transfer/view/:id     → view (record rail + paper + journal)
// /inventory/transfer/new/:dir     → create, dir = in | out (?transferReason=Wastage, ?requestId=)
// /inventory/transfer/:dir/:id     → edit
// Mounted ahead of the generic `inventory` routes (see app.routes.ts).
// ─────────────────────────────────────────────────────────────────────────────

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('inventory/transfer');
  return true;
};

export const TRANSFER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/transfer-list/transfer-list.component').then(m => m.TransferListComponent),
    data: { permissionPath: 'inventoryTransferSecurity.actions.view.access' },
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () => import('./pages/transfer-view/transfer-view.component').then(m => m.TransferViewComponent),
    data: { permissionPath: 'inventoryTransferSecurity.actions.view.access' },
  },
  {
    path: 'new/:direction',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/transfer-form/transfer-form.component').then(m => m.TransferFormComponent),
    data: { permissionPath: 'inventoryTransferSecurity.actions.add.access' },
  },
  {
    // Declared last: it would otherwise swallow `view/:id`.
    path: ':direction/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/transfer-form/transfer-form.component').then(m => m.TransferFormComponent),
    data: { permissionPath: 'inventoryTransferSecurity.actions.add.access' },
  },
];
