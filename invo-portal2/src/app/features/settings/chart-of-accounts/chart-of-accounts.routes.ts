import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

export const CHART_OF_ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/list/chart-of-accounts-list.component')
        .then(m => m.ChartOfAccountsListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/form/chart-of-accounts-form.component')
        .then(m => m.ChartOfAccountsFormComponent),
    canDeactivate: [unsavedChangesGuard],
  },
];
