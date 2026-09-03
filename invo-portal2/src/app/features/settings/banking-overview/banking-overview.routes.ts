import { Routes } from '@angular/router';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

const PERMISSION = { permissionPath: 'bankingOverview.actions.view.access' };

export const BANKING_OVERVIEW_ROUTES: Routes = [
  {
    path: '',
    canActivate: [privilegeGuard],
    data: PERMISSION,
    loadComponent: () =>
      import('./pages/overview/banking-overview.component')
        .then(m => m.BankingOverviewComponent),
  },
  {
    path: 'transactions/:accountId',
    canActivate: [privilegeGuard],
    data: PERMISSION,
    loadComponent: () =>
      import('./pages/transactions/transactions.component')
        .then(m => m.TransactionsComponent),
  },
  {
    path: 'reconciliations/:accountId',
    canActivate: [privilegeGuard],
    data: PERMISSION,
    loadComponent: () =>
      import('./pages/reconciliations/reconciliations.component')
        .then(m => m.ReconciliationsComponent),
  },
  {
    path: 'reconciliations/:accountId/form/:id',
    canActivate: [privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: PERMISSION,
    loadComponent: () =>
      import('./pages/reconciliation-form/reconciliation-form.component')
        .then(m => m.ReconciliationFormComponent),
  },
  {
    // Generic two-file, client-side reconciliation — deliberately NOT
    // scoped to :accountId (see the component's doc-comment). Reuses
    // the same view permission as the rest of Banking Overview since
    // there's no dedicated privilege for it and this is an ungated
    // read/compare-only tool with no persistence.
    path: 'file-reconciliation',
    canActivate: [privilegeGuard],
    data: PERMISSION,
    loadComponent: () =>
      import('./pages/file-reconciliation/file-reconciliation.component')
        .then(m => m.FileReconciliationComponent),
  },
];
