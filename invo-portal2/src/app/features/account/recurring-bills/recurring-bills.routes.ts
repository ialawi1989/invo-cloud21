import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/recurring-bill            → list
// /account/recurring-bill/view/:id   → view
// /account/recurring-bill/:id        → form (`new` / `0` = create)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/recurring-bills');
  return true;
};

export const RECURRING_BILLS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringBillSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-bills-list/recurring-bills-list.component').then(m => m.RecurringBillsListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringBillSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-bill-view/recurring-bill-view.component').then(m => m.RecurringBillViewComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'recurringBillSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/recurring-bill-form/recurring-bill-form.component').then(m => m.RecurringBillFormComponent),
  },
];
