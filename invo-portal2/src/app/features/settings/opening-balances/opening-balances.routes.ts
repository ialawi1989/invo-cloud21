import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { privilegeGuard } from '@core/guards/privilege.guard';

export const OPENING_BALANCES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'openingBalances.actions.view.access' },
    loadComponent: () =>
      import('./pages/opening-balances.component')
        .then(m => m.OpeningBalancesComponent),
  },
];
