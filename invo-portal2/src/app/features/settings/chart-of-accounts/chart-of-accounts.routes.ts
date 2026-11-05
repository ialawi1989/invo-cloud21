import { Routes } from '@angular/router';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/chart-of-accounts            → list
// /account/chart-of-accounts/view/:id   → account view (KPIs + journals)
// /account/chart-of-accounts/:id        → add (`new`) / edit
// `view` is declared before `:id` so it isn't swallowed as an id.
export const CHART_OF_ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [privilegeGuard],
    data: { permissionPath: 'accountSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/list/chart-of-accounts-list.component')
        .then(m => m.ChartOfAccountsListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [privilegeGuard],
    data: { permissionPath: 'accountSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/view/chart-of-accounts-view.component')
        .then(m => m.ChartOfAccountsViewComponent),
  },
  {
    path: ':id',
    canActivate: [privilegeGuard],
    data: { permissionPath: 'accountSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/form/chart-of-accounts-form.component')
        .then(m => m.ChartOfAccountsFormComponent),
    canDeactivate: [unsavedChangesGuard],
  },
];
